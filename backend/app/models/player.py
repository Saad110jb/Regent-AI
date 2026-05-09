from pydantic import BaseModel, Field
from typing import Optional, List

class CricketStats(BaseModel):
    # Batting
    total_runs: int = 0
    highest_score: int = 0
    batting_average: float = 0.0
    strike_rate: float = 0.0
    
    # Bowling
    wickets: int = 0
    best_bowling_figures: str = "0/0"
    economy_rate: float = 0.0
    top_speed_kph: float = 0.0  # Tracked by your AI!
    average_speed_kph: float = 0.0
    sessions_count: int = 0

class UpdateCricketStats(BaseModel):
    total_runs: Optional[int] = None
    highest_score: Optional[int] = None
    batting_average: Optional[float] = None
    strike_rate: Optional[float] = None
    wickets: Optional[int] = None
    best_bowling_figures: Optional[str] = None
    economy_rate: Optional[float] = None
    top_speed_kph: Optional[float] = None
    average_speed_kph: Optional[float] = None
    sessions_count: Optional[int] = None

class PlayerModel(BaseModel):
    user_id: str  # Link to the User
    team_id: Optional[str] = None
    
    # --- Player Specialty ---
    player_type: str = "all-rounder" # batsman, bowler, wicket-keeper, all-rounder
    batting_style: str = "right-hand" # right-hand, left-hand
    bowling_style: Optional[str] = "right-arm-fast" # fast, leg-spin, off-spin
    jersey_number: Optional[int] = None
    
    # --- Aggregated Stats ---
    # These are updated after every match or AI analysis session
    performance_stats: CricketStats = Field(default_factory=CricketStats)
    
    # --- AI Features ---
    squad_rank: Optional[int] = None
    ai_suggestions: List[str] = []
    
    # --- Achievements ---
    achievements: List[str] = [] # e.g., "Man of the Match - Faisalabad Cup"
    
    # --- Pending Invites ---
    invitations: List[dict] = []

    class Config:
        populate_by_name = True