from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AuditLog(BaseModel):
    user_id: str
    action: str  # login, password_change, subscription_upgrade, video_delete
    ip_address: str
    user_agent: str # Device info (e.g., iPhone 15, Android 14)
    status: str = "success" # success, failed
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SecuritySettings(BaseModel):
    user_id: str
    two_factor_enabled: bool = False
    last_password_change: datetime = Field(default_factory=datetime.utcnow)
    active_sessions: int = 1
    recovery_email: Optional[str] = None