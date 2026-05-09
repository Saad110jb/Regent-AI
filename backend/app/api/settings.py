from fastapi import APIRouter, HTTPException, Depends, Request
from app.api.auth import get_current_user
from app.models.settings import UserSettings
from app.models.security import SecuritySettings, AuditLog
from app.core.repository import SecurityRepository, SettingsRepository
from datetime import datetime, timezone

router = APIRouter(prefix="/settings", tags=["Security & Preferences"])

# --- Security Endpoints ---

@router.get("/security", response_model=SecuritySettings)
async def get_security_details(current_user: dict = Depends(get_current_user)):
    """Fetches 2FA status and session info."""
    user_id = str(current_user["_id"])
    settings = await SecurityRepository.get_security_settings(user_id)
    if not settings:
        # Initialize default settings if none exist
        settings = SecuritySettings(user_id=user_id)
        await SecurityRepository.upsert_security_settings(settings.model_dump())
        return settings
    return settings

@router.post("/security/2fa/toggle")
async def toggle_2fa(enabled: bool, current_user: dict = Depends(get_current_user)):
    """Enables or disables Two-Factor Authentication across unified settings."""
    user_id = str(current_user["_id"])
    
    # 1. Update high-security status
    await SecurityRepository.update_2fa_status(user_id, enabled)
    
    # 2. Update unified user preferences
    await SettingsRepository.update_preferences(user_id, {"two_factor_enabled": enabled})
    
    # 3. Log the action for security auditing
    await SecurityRepository.log_audit(AuditLog(
        user_id=user_id,
        action="2fa_toggle",
        status="success",
        ip_address="internal",
        user_agent="Regent AI Mobile"
    ).model_dump())
    
    return {"message": f"2FA {'enabled' if enabled else 'disabled'} across all systems."}

# --- User Preference Endpoints ---

@router.get("/preferences", response_model=UserSettings)
async def get_user_preferences(current_user: dict = Depends(get_current_user)):
    """Retrieves theme, language, and notification toggles."""
    user_id = str(current_user["_id"])
    prefs = await SettingsRepository.get_preferences(user_id)
    if not prefs:
        prefs = UserSettings(user_id=user_id)
        await SettingsRepository.update_preferences(user_id, prefs.model_dump())
        return prefs
    return prefs

@router.patch("/preferences")
async def update_preferences(updates: dict, current_user: dict = Depends(get_current_user)):
    """Partially updates settings (e.g., changing theme to 'dark')."""
    user_id = str(current_user["_id"])
    success = await SettingsRepository.update_preferences(user_id, updates)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update preferences.")
    return {"message": "Settings updated successfully."}

# --- Audit Logs ---

@router.get("/logs")
async def get_my_audit_logs(current_user: dict = Depends(get_current_user)):
    """Allows users to see their recent login and security history."""
    user_id = str(current_user["_id"])
    return await SecurityRepository.get_user_logs(user_id)
