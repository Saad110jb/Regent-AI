from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import uuid4

class VideoMetadata(BaseModel):
    # --- Identifiers ---
    video_id: str = Field(default_factory=lambda: str(uuid4()), alias="_id")
    user_id: str  # The player or coach who uploaded it
    player_id: Optional[str] = None  # The specific player being analyzed
    
    # --- File Details ---
    filename: str
    file_path: str  # Path in the backend/uploads folder
    file_size_mb: float
    duration_seconds: float
    resolution: str = "1080p"
    
    # --- Processing State ---
    # pending -> processing -> completed -> failed
    status: str = "pending"
    error_message: Optional[str] = None
    processing_time_sec: Optional[float] = None
    
    # --- Timestamps ---
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True