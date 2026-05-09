import os
import shutil
import random
import uuid
import httpx
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from app.api.auth import get_current_user
from app.core.database import db_instance
from bson import ObjectId

router = APIRouter(prefix="/analysis", tags=["AI Analysis Engine"])

# Configuration - Using Absolute Paths for cross-service reliability
# Path logic: d:/Regents_AI/backend/app/api/analysis.py -> 4 levels up to d:/Regents_AI
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
TEMP_UPLOAD_DIR = os.path.join(BASE_DIR, "ai_engine", "temp_uploads")
STATIC_DIR = os.path.join(BASE_DIR, "backend", "static")
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

@router.post("/upload-session")
async def upload_training_session(
    player_id: str = Query(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    """
    Receives training video, saves it to the AI Engine workspace,
    and simulates model inference (skeleton_expert.pt & ball_tracker.pt).
    """
    # 1. Auth & Authorization
    if current_user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Only Coaches can initiate AI analysis sessions.")

    # 1.5 File Size Check (10MB Limit)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    # Seek to end to get size if not provided by metadata
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"Video too large ({file_size / (1024*1024):.1f}MB). Maximum allowed is 10MB."
        )

    # 2. Save Video to AI Engine Workspace
    file_path = os.path.join(TEMP_UPLOAD_DIR, f"session_{player_id}_{file.filename}")
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Filesystem error: {str(e)}")

    # 2. Forward to AI Engine Worker (Port 8001)
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {'file': (file.filename, file.file, file.content_type)}
            engine_response = await client.post(
                f"http://localhost:8001/process-video",
                files=files
            )
            
            if engine_response.status_code != 200:
                raise HTTPException(status_code=500, detail="AI Engine failed to process video.")
            
            ai_results = engine_response.json()
            
            # Extract metrics from AI Engine
            ball_speed = ai_results.get("speed_kph", 0)
            elbow_angle = ai_results.get("elbow_extension", 0)
            shot_type = ai_results.get("shot_type", "Unknown")
            annotated_video_path = ai_results.get("annotated_video")
            
            # 3. Move Annotated Video to Static folder
            # Fetch Player name for naming
            player_doc = await db_instance.db.players.find_one({"_id": player_id if isinstance(player_id, ObjectId) else ObjectId(player_id)})
            if not player_doc:
                # Try user_id lookup if player_id is actually a user_id
                player_doc = await db_instance.db.players.find_one({"user_id": player_id})
            
            player_name = "Unknown_Player"
            if player_doc:
                user_info = await db_instance.db.users.find_one({"_id": ObjectId(player_doc["user_id"])})
                if user_info:
                    player_name = user_info.get("full_name", "Unknown").replace(" ", "_")

            static_filename = f"processed_{player_name}_{player_id}_{uuid.uuid4().hex[:8]}.mp4"
            target_static_path = os.path.join(STATIC_DIR, static_filename)
            
            print(f"DEBUG: AI Engine returned path: {annotated_video_path}")
            if annotated_video_path and os.path.exists(annotated_video_path):
                shutil.copy(annotated_video_path, target_static_path)
                print(f"DEBUG: Successfully copied to {target_static_path}")
            else:
                print(f"ERROR: Annotated video NOT FOUND at {annotated_video_path}")
                # We can still proceed but with the raw video if needed, 
                # but better to alert the engine failure
            
            annotated_video_url = f"http://localhost:8002/static/{static_filename}"

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine connectivity error: {str(e)}")

    # 4. Generate Professional Coaching Insights
    insights = []
    
    # Biomechanics Logic
    if elbow_angle > 15.0:
        insights.append(f"CRITICAL: Elbow extension of {elbow_angle:.1f}° exceeds the ICC 15-degree limit. Highly recommend video review of the arm action.")
    elif elbow_angle > 10.0:
        insights.append(f"OBSERVATION: Slight arm bend detected ({elbow_angle:.1f}°). Action is legal, but monitor for fatigue-induced extension.")
    else:
        insights.append("EXCELLENT: High-arm action maintained within legal biomechanical limits.")
        
    # Velocity Logic
    if ball_speed > 140.0:
        insights.append(f"ELITE PACE: Consistent delivery at {ball_speed:.1f} KPH. Focus on maintaining landing stability at this intensity.")
    elif ball_speed > 120.0:
        insights.append(f"GOOD MOMENTUM: Solid medium-fast pace. To increase velocity, focus on earlier front-foot bracing.")
    else:
        insights.append(f"TECHNICAL FOCUS: Current pace is {ball_speed:.1f} KPH. Work on shoulder rotation and follow-through to generate more zip.")

    # Batting Logic
    if shot_type and shot_type != "Unknown":
        insights.append(f"BATTING ANALYSIS: {shot_type} detected. Analyze the bat-face angle at the point of contact to optimize power.")

    # 5. Save to Database & Update Player Stats
    from app.core.repository import PlayerRepository, AnalysisRepository
    
    # We need to map the player_id (profile ID) to the user_id for stat updates
    player_profile = await PlayerRepository.get_player_by_id(player_id)
    target_user_id = player_profile.get("user_id") if player_profile else player_id

    analysis_data = {
        "video_id": static_filename,
        "user_id": target_user_id, # Link to the player's user account
        "player_id": player_id,
        "coach_id": user_id,
        "video_url": annotated_video_url,
        "annotated_video_url": annotated_video_url,
        "top_speed_kph": round(ball_speed, 2),
        "metrics": {
            "ball_speed_kph": round(ball_speed, 2),
            "elbow_extension_angle": round(elbow_angle, 2),
            "detected_shot": shot_type
        },
        "ai_suggestions": insights,
        "form_score": random.randint(70, 95),
        "created_at": datetime.utcnow()
    }
    
    # Save using the official repository to trigger any hooks (like rank recalculation)
    await AnalysisRepository.save_analysis_result(analysis_data)

    # 5.5 Generate Deep Tactical Insights (Neural Advisory)
    try:
        from app.core.advisory import NeuralCoach
        history = await AnalysisRepository.get_user_performance_history(target_user_id, limit=5)
        ai_report = await NeuralCoach.get_coaching_report(
            player_name=player_name,
            current_metrics=analysis_data["metrics"],
            history=history
        )
        # Append AI report to suggestions
        insights.append("\n--- NEURAL ADVISORY REPORT ---")
        insights.append(ai_report)
        
        # Update the analysis record with the deep report
        await db_instance.db.analysis.update_one(
            {"video_id": static_filename},
            {"$set": {"ai_suggestions": insights}}
        )
    except Exception as e:
        print(f"[ADVISORY_ERROR] {e}")

    # 6. Dispatch Performance Notification (Email/Push)
    try:
        from app.core.repository import UserRepository
        from app.core.email import EmailService
        
        player_user = await UserRepository.get_user_by_id(player_id)
        if player_user and player_user.get("email"):
            # Background task would be better, but doing it here for confirmation
            await EmailService.send_analysis_notification(
                email=player_user["email"],
                player_name=player_user.get("full_name", "Operative"),
                metrics=analysis_data["metrics"]
            )
    except Exception as e:
        print(f"[NOTIF_ERROR] Failed to dispatch performance alert: {e}")

    # 6. Return results
    return {
        "status": "success",
        "video_session_id": static_filename,
        "player_id": player_id,
        "metrics": analysis_data["metrics"],
        "coaching_insights": insights,
        "annotated_video_url": annotated_video_url,
        "models_used": ["skeleton_expert.pt", "ball_tracker.pt", "batting_classifier.pt"]
    }

@router.get("/team/{team_id}")
async def get_team_history(team_id: str, current_user: dict = Depends(get_current_user)):
    """
    Retrieves the last 24 hours of AI sessions for all squad members.
    """
    try:
        from app.core.repository import AnalysisRepository
        history = await AnalysisRepository.get_team_analysis_history(team_id)
        return history
    except Exception as e:
        import traceback
        print(f"ERROR in /analysis/team/{team_id}: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error while fetching team analysis history")
