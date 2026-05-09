from fastapi import APIRouter, HTTPException, status, Depends
from app.models.subscription import SubscriptionModel
from app.core.repository import SubscriptionRepository
from app.api.auth import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/subscriptions", tags=["Billing & Subscriptions"])

@router.post("/subscribe", response_model=SubscriptionModel)
async def create_subscription(
    sub_data: SubscriptionModel, 
    current_user: dict = Depends(get_current_user)
):
    """
    Initializes a subscription after a successful payment.
    """
    sub_data.user_id = str(current_user["_id"])
    
    # Logic to calculate expiry (e.g., 30 days for monthly)
    if not sub_data.expiry_date:
        days = 365 if sub_data.billing_cycle == "yearly" else 30
        sub_data.expiry_date = datetime.now(timezone.utc) + timedelta(days=days)

    success = await SubscriptionRepository.create_subscription(sub_data.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to activate subscription.")
    
    return sub_data

@router.get("/me")
async def get_my_subscription(current_user: dict = Depends(get_current_user)):
    """
    Checks the status of the current user's plan.
    """
    sub = await SubscriptionRepository.get_active_subscription(str(current_user["_id"]))
    if not sub:
        return {"status": "inactive", "tier": "free"}
    
    # Check if expired
    if sub["expiry_date"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await SubscriptionRepository.update_status(sub["subscription_id"], "expired")
        return {"status": "expired", "tier": "free"}
        
    return sub

@router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """
    Disables auto-renewal for the user.
    """
    user_id = str(current_user["_id"])
    success = await SubscriptionRepository.cancel_subscription(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="No active subscription found.")
    
    return {"message": "Auto-renewal cancelled successfully."}

