from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

class ChatSettings(BaseModel):
    retention_period: str = "Never" # Options: 24 Hours, 1 Week, 1 Month, Never
    broadcast_mode: bool = False   # Only Coach can send messages
    only_coach_media: bool = False # Players can only send text if True
    muted_users: List[str] = []    # List of User IDs

class TeamModel(BaseModel):
    # --- Basic Info ---
    name: str = "The Regents"
    team_logo: Optional[str] = None
    location: str = "Faisalabad, Pakistan"
    description: Optional[str] = "Professional local cricket club."
    
    # --- Leadership (Linked to Player IDs) ---
    captain_id: str
    vice_captain_id: Optional[str] = None  # e.g., Abdul Samad's Player ID
    coach_id: Optional[str] = None
    
    # --- Membership ---
    player_ids: List[str] = []  # List of Player IDs, not User IDs
    max_squad_size: int = 20
    invite_code: str = Field(..., description="Unique code to join the team")
    
    # --- Stats & History ---
    matches_played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    
    # --- Chat Settings ---
    chat_settings: ChatSettings = Field(default_factory=ChatSettings)
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_schema_extra = {
            "example": {
                "name": "The Regents",
                "location": "Faisalabad",
                "captain_id": "player_saad_001",
                "invite_code": "REGENTS2026"
            }
        }


