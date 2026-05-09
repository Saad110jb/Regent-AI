from pydantic import BaseModel, Field
from typing import List, Optional

class PlanFeature(BaseModel):
    name: str
    is_available: bool
    limit: Optional[int] = None  # e.g., 10 for "10 videos per month"

class PlanModel(BaseModel):
    plan_id: str = Field(..., example="pro_monthly")
    name: str = Field(..., example="Regents Pro")
    description: str
    price: float
    currency: str = "PKR"
    interval: str = "month"  # month, year, lifetime
    
    # --- Feature Flags ---
    features: List[PlanFeature] = []
    
    # --- Startup Metrics ---
    is_active: bool = True
    is_popular: bool = False # For UI "Most Popular" tag
    
    class Config:
        json_schema_extra = {
            "example": {
                "plan_id": "academy_yearly",
                "name": "Academy Elite",
                "price": 15000.0,
                "interval": "year",
                "features": [
                    {"name": "Unlimited AI Analysis", "is_available": True},
                    {"name": "Team Management", "is_available": True},
                    {"name": "Custom Coaching Reports", "is_available": True}
                ]
            }
        }