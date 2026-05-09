from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from uuid import uuid4

class SubscriptionModel(BaseModel):
    user_id: str
    subscription_id: str = Field(default_factory=lambda: str(uuid4()))
    
    plan_id: str
    plan_name: str
    tier: str = "free"
    
    price: float
    currency: str = "PKR"
    billing_cycle: str = "monthly"
    auto_renew: bool = True
    
    status: str = "active"
    is_trial: bool = False
    
    # Modernized datetime defaults for Python 3.13
    start_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expiry_date: datetime
    last_billing_date: Optional[datetime] = None
    next_billing_date: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    
    payment_method: str = "jazzcash"
    transaction_id: Optional[str] = None
    gateway_metadata: Optional[Dict[str, Any]] = {} 
    
    promo_code: Optional[str] = None
    discount_applied: float = 0.0

    class Config:
        populate_by_name = True