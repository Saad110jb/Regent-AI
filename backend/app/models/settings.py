from pydantic import BaseModel
from typing import Optional

class UserSettings(BaseModel):
    user_id: str
    
    # --- Notifications ---
    email_notifications: bool = True
    push_notifications: bool = True
    match_reminders: bool = True
    
    # --- App Preferences ---
    theme: str = "dark" # dark, light, system
    language: str = "en" # en, ur
    
    # --- Security & Privacy ---
    two_factor_enabled: bool = True
    is_profile_public: bool = True
    show_stats_to_everyone: bool = True
    
    # --- AI Specific Settings ---
    auto_analyze_uploads: bool = False # Analyze as soon as upload finishes
    metric_system: str = "metric" # metric (kph) vs imperial (mph)