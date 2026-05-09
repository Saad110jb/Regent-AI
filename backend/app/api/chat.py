from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, File, UploadFile
from bson import ObjectId
from typing import List, Dict, Any
from app.core.database import db_instance
from app.api.auth import get_current_user, oauth2_scheme
from datetime import datetime, timezone
import json
import os
import shutil
import uuid
from jose import JWTError, jwt
from app.utils.security import SECRET_KEY, ALGORITHM
from app.core.repository import UserRepository

router = APIRouter(prefix="/chat", tags=["Squad Chat"])

class ConnectionManager:
    def __init__(self):
        # team_id -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, team_id: str):
        await websocket.accept()
        if team_id not in self.active_connections:
            self.active_connections[team_id] = []
        self.active_connections[team_id].append(websocket)

    def disconnect(self, websocket: WebSocket, team_id: str):
        if team_id in self.active_connections:
            self.active_connections[team_id].remove(websocket)
            if not self.active_connections[team_id]:
                del self.active_connections[team_id]

    async def broadcast_to_team(self, team_id: str, message: dict):
        if team_id in self.active_connections:
            # Create a copy of the list to avoid modifying it during iteration if someone disconnects
            for connection in list(self.active_connections[team_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"WS Send Error: {e}")
                    self.disconnect(connection, team_id)

manager = ConnectionManager()

# Helper to authenticate WS connections via query param
async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return await UserRepository.get_user_by_id(user_id)
    except JWTError:
        return None

@router.websocket("/ws/{team_id}")
async def websocket_endpoint(websocket: WebSocket, team_id: str, token: str = Query(...)):
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, team_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # 1. Fetch current team settings
            team = await db_instance.db.teams.find_one({"_id": ObjectId(team_id)})
            settings = team.get("chat_settings", {}) if team else {}
            
            # 2. Enforce Permissions (Coach bypasses all restrictions)
            user_id_str = str(user["_id"])
            user_role = user.get("role", "player")
            is_coach = user_role == "coach"
            
            if not is_coach:
                # Check Muting
                if user_id_str in settings.get("muted_users", []):
                    await websocket.send_json({"type": "system", "content": "You have been muted by the coach."})
                    continue
                
                # Check Broadcast Mode
                if settings.get("broadcast_mode", False):
                    await websocket.send_json({"type": "system", "content": "Only coaches can send messages in Broadcast Mode."})
                    continue
            
            # 3. Parse message data
            msg_payload = {"type": "text", "content": data}
            try:
                parsed = json.loads(data)
                if isinstance(parsed, dict) and "content" in parsed:
                    msg_payload.update(parsed)
            except:
                pass 
            
            # 4. Check Content Control (Media restricted to coach)
            if not is_coach and settings.get("only_coach_media", False):
                if msg_payload.get("type") in ["image", "video", "document"]:
                    await websocket.send_json({"type": "system", "content": "Media sharing is currently restricted to coaches."})
                    continue

            # 5. Prepare message metadata
            message_doc = {
                "team_id": team_id,
                "sender_id": str(user["_id"]),
                "sender_name": user.get("full_name", "Operative"),
                "sender_role": user.get("role", "player"),
                "type": msg_payload.get("type", "text"),
                "content": msg_payload.get("content", ""),
                "file_url": msg_payload.get("file_url"),
                "filename": msg_payload.get("filename"),
                "timestamp": datetime.now(timezone.utc)
            }
            
            # 3. Persist to MongoDB
            result = await db_instance.db.messages.insert_one(message_doc)
            
            # 4. Format for transmission
            message_doc["_id"] = str(result.inserted_id)
            message_doc["timestamp"] = message_doc["timestamp"].isoformat()
            
            # 5. Broadcast to all active team members
            await manager.broadcast_to_team(team_id, message_doc)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, team_id)
        # Optional: Broadcast disconnect
        pass

@router.get("/history/{team_id}")
async def get_chat_history(team_id: str, limit: int = 100, current_user: dict = Depends(get_current_user)):
    """
    Retrieves the historical chat logs for the encrypted squad channel.
    """
    try:
        from datetime import timedelta
        # 1. Fetch team's retention policy
        team = await db_instance.db.teams.find_one({"_id": ObjectId(team_id)})
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")
            
        retention_days = team.get("chat_retention_days", 30) # default 30 days
        
        # 2. Add time filter to cursor
        query = {"team_id": team_id}
        if retention_days > 0:
            cutoff = datetime.utcnow() - timedelta(days=retention_days)
            query["timestamp"] = {"$gte": cutoff}
            
        cursor = db_instance.db.messages.find(query).sort("timestamp", -1).limit(limit)
        messages = await cursor.to_list(length=limit)
        
        # Reverse to return chronological order (oldest first for chat UI)
        messages.reverse()
        
        # Harden serialization
        for msg in messages:
            msg["_id"] = str(msg["_id"])
            # Format datetime back to ISO string if it's a datetime object
            if isinstance(msg["timestamp"], datetime):
                msg["timestamp"] = msg["timestamp"].isoformat()
            
        return messages
    except Exception as e:
        import traceback
        print(f"ERROR in /chat/history/{team_id}: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error while fetching chat history")

@router.post("/upload")
async def upload_chat_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Uploads an image, video, or document to the secure chat asset storage.
    """
    UPLOAD_DIR = os.path.join("static", "chat_assets")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_url = f"http://localhost:8002/static/chat_assets/{unique_name}"
    
    # Determine message type
    msg_type = "document"
    if file_ext.lower() in [".jpg", ".jpeg", ".png", ".gif"]:
        msg_type = "image"
    elif file_ext.lower() in [".mp4", ".mov", ".avi"]:
        msg_type = "video"
        
    return {
        "status": "success",
        "file_url": file_url,
        "filename": file.filename,
        "type": msg_type
    }

@router.patch("/message/{message_id}")
async def edit_message(
    message_id: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Edits a tactical message. Only the sender can perform this operation.
    """
    msg = await db_instance.db.messages.find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
        
    if msg["sender_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized to edit this message.")
        
    await db_instance.db.messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"content": content, "is_edited": True, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Broadcast the edit signal to the team
    edit_signal = {
        "action": "message_edited",
        "message_id": message_id,
        "new_content": content
    }
    await manager.broadcast_to_team(msg["team_id"], edit_signal)
    
    return {"status": "success"}

@router.delete("/message/{message_id}")
async def delete_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Purges a message from the squad channel. Only the sender can perform this operation.
    """
    msg = await db_instance.db.messages.find_one({"_id": ObjectId(message_id)})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
        
    if msg["sender_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized to purge this message.")
        
    await db_instance.db.messages.delete_one({"_id": ObjectId(message_id)})
    
    # Broadcast the delete signal to the team
    delete_signal = {
        "action": "message_deleted",
        "message_id": message_id
    }
    await manager.broadcast_to_team(msg["team_id"], delete_signal)
    
    return {"status": "success"}

# --- ADMIN SETTINGS ---

@router.get("/settings/{team_id}")
async def get_chat_settings(team_id: str, current_user: dict = Depends(get_current_user)):
    team = await db_instance.db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return team.get("chat_settings", {
        "retention_period": "Never",
        "broadcast_mode": False,
        "only_coach_media": False,
        "muted_users": []
    })

@router.patch("/settings/{team_id}")
async def update_chat_settings(team_id: str, settings: dict, current_user: dict = Depends(get_current_user)):
    """
    Updates automated deletion and permission policies.
    """
    if current_user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can update group settings.")

    # Validate retention period options
    valid_periods = ["24 Hours", "1 Week", "1 Month", "Never"]
    if "retention_period" in settings and settings["retention_period"] not in valid_periods:
        raise HTTPException(status_code=400, detail="Invalid retention period.")

    result = await db_instance.db.teams.update_one(
        {"_id": ObjectId(team_id), "coach_id": str(current_user["_id"])},
        {"$set": {"chat_settings": settings}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found or you are not the assigned coach.")

    # Broadcast settings update to all connected team members
    settings_signal = {
        "action": "settings_updated",
        "settings": settings
    }
    await manager.broadcast_to_team(team_id, settings_signal)

    return {"status": "success", "updated_settings": settings}
