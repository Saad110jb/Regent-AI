import os
import shutil
import httpx
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks

# Updated Absolute Imports
from app.models.video import VideoMetadata
from app.models.analysis import AnalysisResult
from app.core.repository import VideoRepository, SubscriptionRepository, AnalysisRepository, PlanRepository
from app.api.auth import get_current_user

router = APIRouter(prefix="/videos", tags=["Videos"])

# Configuration
AI_WORKER_URL = "http://localhost:8001/process-video"
UPLOAD_DIR = "uploads/videos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def check_subscription_and_limits(user_id: str):
    """
    Validates if the user is allowed to perform AI analysis based on their subscription.
    """
    # 1. Fetch Active Subscription via Repository
    sub = await SubscriptionRepository.get_active_subscription(user_id)
    if not sub:
        raise HTTPException(status_code=403, detail="Active subscription required for AI Analysis.")

    # 2. Check Expiry
    if sub["expiry_date"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        # Update status to expired if it hasn't been already
        await SubscriptionRepository.update_status(str(sub["_id"]), "expired")
        raise HTTPException(status_code=403, detail="Subscription has expired. Please renew.")

    # 3. Check Plan Usage/Limits
    plan = await PlanRepository.get_plan_by_id(sub["tier"]) # tier stores 'pro', 'starter', etc.
    if not plan:
        raise HTTPException(status_code=404, detail="Plan details not found.")

    # Look for the AI Speed Tracking feature limit
    ai_feature = next((f for f in plan.get("features", []) if f["name"] == "AI Speed Tracking"), None)
    
    if ai_feature and ai_feature.get("limit") is not None:
        # Count videos uploaded during current billing cycle
        user_videos = await VideoRepository.get_videos_by_user(user_id)
        # Filter for videos uploaded after subscription start_date
        current_cycle_videos = [v for v in user_videos if v["uploaded_at"] >= sub["start_date"]]
        
        if len(current_cycle_videos) >= ai_feature["limit"]:
            raise HTTPException(
                status_code=403, 
                detail=f"Plan limit reached ({ai_feature['limit']} videos). Upgrade for unlimited access."
            )
    return sub

async def process_remote_analysis(video_id: str, user_id: str, file_path: str):
    """
    Background Task: Sends video to AI Worker and saves results using Repositories.
    """
    try:
        await VideoRepository.update_status(video_id, "processing")

        async with httpx.AsyncClient(timeout=600.0) as client:
            with open(file_path, "rb") as f:
                files = {"file": (os.path.basename(file_path), f, "video/mp4")}
                response = await client.post(AI_WORKER_URL, files=files)
        
        if response.status_code == 200:
            data = response.json()
            
            # Map worker response to AnalysisResult
            analysis = AnalysisResult(
                video_id=video_id,
                user_id=user_id,
                ball_path=data.get("ball_path", []),
                player_form=data.get("player_form", []),
                top_speed_kph=data.get("top_speed_kph", 0.0),
                shot_type_detected=data.get("shot_type_detected"),
                ai_suggestions=data.get("ai_suggestions", []),
                form_score=data.get("form_score", 0.0)
            )

            # Save using AnalysisRepository
            await AnalysisRepository.save_analysis_result(analysis.model_dump())
            # Mark video as completed
            await VideoRepository.update_status(video_id, "completed")
        else:
            raise Exception(f"AI Worker returned error: {response.status_code}")

    except Exception as e:
        await VideoRepository.update_status(video_id, "failed", error_message=str(e))

@router.post("/upload", response_model=VideoMetadata)
async def upload_video(
    background_tasks: BackgroundTasks,
    player_id: Optional[str] = None,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    
    if current_user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Only Coaches can upload videos.")

    # --- 1. Guard against unauthorized usage ---
    await check_subscription_and_limits(user_id)

    # --- 1.5 File Size Check (10MB Limit) ---
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"Video too large ({file_size / (1024*1024):.1f}MB). Maximum allowed is 10MB."
        )

    # --- 2. Save Permanent Copy ---
    video_id = str(uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{video_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # --- 3. Initialize Metadata ---
    video_meta = VideoMetadata(
        video_id=video_id,
        user_id=user_id,
        player_id=player_id,
        filename=file.filename,
        file_path=file_path,
        file_size_mb=os.path.getsize(file_path) / (1024 * 1024),
        status="pending",
        uploaded_at=datetime.now(timezone.utc)
    )
    
    # Save using VideoRepository
    await VideoRepository.create_video_metadata(video_meta.model_dump(by_alias=True))

    # --- 4. Offload AI processing to background ---
    background_tasks.add_task(process_remote_analysis, video_id, user_id, file_path)

    return video_meta

@router.get("/my-analysis")
async def get_my_analysis(current_user: dict = Depends(get_current_user)):
    """
    Retrieves the analysis history for the logged-in player.
    """
    user_id = str(current_user["_id"])
    history = await AnalysisRepository.get_user_performance_history(user_id)
    return history
