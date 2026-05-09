from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime, timezone
import re

# --- Base Schema (Common attributes) ---
class UserBase(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    role: str = Field("player", pattern="^(captain|coach|player|analyst)$")
    location: str = "Faisalabad"
    is_active: bool = True
    subscription_tier: str = "free"

# --- Dynamic Registration Schema ---
class UserCreate(BaseModel):
    """Only requires the bare essentials for sign-up"""
    full_name: str = Field(..., min_length=3)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str = Field(..., pattern="^(coach|player)$")

    @field_validator('password')
    @classmethod
    def password_complexity(cls, v: str):
        if not re.search(r'[A-Z]', v) or not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one uppercase letter and one number')
        return v

# --- Profile Persistence (What actually lives in MongoDB) ---
class UserInDB(UserBase):
    id: Optional[str] = Field(None, alias="_id")
    hashed_password: str
    
    # Player specific (Optional initially)
    primary_skill: Optional[str] = None 
    batting_hand: Optional[str] = None
    bowling_style: Optional[str] = None
    
    # Coach specific (Optional initially)
    specialization: Optional[str] = None
    years_of_experience: int = 0
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    last_ip: Optional[str] = None

    class Config:
        populate_by_name = True

# --- API Response Schema ---
class UserResponse(UserBase):
    id: str = Field(alias="_id")
    primary_skill: Optional[str] = None
    # Include other fields you want the frontend to see
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True