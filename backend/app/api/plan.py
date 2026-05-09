from fastapi import APIRouter, HTTPException, status, Depends
from app.models.plan import PlanModel
from app.core.repository import PlanRepository
from app.api.auth import get_current_user
from typing import List

router = APIRouter(prefix="/plans", tags=["Subscription Plans"])

@router.get("/", response_model=List[PlanModel])
async def get_all_active_plans():
    """
    Public endpoint to fetch all active subscription plans.
    Used for the pricing table in the app/website.
    """
    plans = await PlanRepository.get_active_plans()
    return plans

@router.post("/", response_model=PlanModel, status_code=status.HTTP_201_CREATED)
async def create_new_plan(plan: PlanModel, current_user: dict = Depends(get_current_user)):
    """
    Admin-only endpoint to define a new plan tier (e.g., introducing 'Regents Pro').
    """
    # Security: Ensure only admins can create plans
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only administrators can manage plans."
        )

    success = await PlanRepository.create_plan(plan.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save plan.")
    return plan

@router.get("/{plan_id}", response_model=PlanModel)
async def get_plan_by_id(plan_id: str):
    """
    Fetches details for a specific plan.
    """
    plan = await PlanRepository.get_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    return plan
