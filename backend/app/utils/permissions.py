from fastapi import HTTPException, status, Depends
from app.api.auth import get_current_user
from app.core.repository import SubscriptionRepository, PlanRepository, VideoRepository

async def check_feature_access(feature_name: str, current_user: dict = Depends(get_current_user)):
    """
    Checks if the user has access to a specific feature based on their plan.
    """
    user_id = str(current_user["_id"])
    
    # 1. Get Active Subscription
    sub = await SubscriptionRepository.get_active_subscription(user_id)
    plan_id = sub["plan_id"] if sub else "free_tier" # Default to free if no sub found
    
    # 2. Get Plan Details
    plan = await PlanRepository.get_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=500, detail="Subscription plan configuration error.")

    # 3. Find the specific feature in the plan
    feature = next((f for f in plan["features"] if f["name"] == feature_name), None)
    
    if not feature or not feature["is_available"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"The '{feature_name}' feature is not available on your current plan."
        )

    # 4. Handle Limits (e.g., AI Speed Tracking limit: 5)
    if feature.get("limit") is not None:
        usage_count = await VideoRepository.get_user_usage_count(user_id)
        if usage_count >= feature["limit"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You have reached your limit for {feature_name}. Upgrade to Pro for unlimited access!"
            )
            
    return True