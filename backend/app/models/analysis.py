from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class BallCoordinate(BaseModel):
    frame: int
    timestamp_ms: int
    x: float  # Normalized 0.0 to 1.0
    y: float
    confidence: float # YOLO confidence score

class BiomechanicMarkers(BaseModel):
    frame: int
    elbow_angle: float   # Essential for straight drive check
    knee_angle: float    # For front-foot stride
    shoulder_tilt: float
    is_balanced: bool    # Derived logic from MediaPipe keypoints

class AnalysisResult(BaseModel):
    video_id: str
    user_id: str
    
    # --- The Data ---
    ball_path: List[BallCoordinate] = []
    player_form: List[BiomechanicMarkers] = []
    
    # --- Aggregated Metrics ---
    top_speed_kph: float = 0.0
    release_point_height: float = 0.0
    shot_type_detected: Optional[str] = None # e.g., "Cover Drive"
    
    # --- Feedback ---
    # AI-generated tips based on the biomechanics
    ai_suggestions: List[str] = [] 
    form_score: float = 0.0 # 0-100 rating
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "video_id": "vid_987",
                "top_speed_kph": 135.5,
                "shot_type_detected": "Straight Drive",
                "ai_suggestions": ["Keep your head still", "High left elbow"]
            }
        }