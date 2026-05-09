from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import uuid4

class TransactionModel(BaseModel):
    transaction_id: str = Field(default_factory=lambda: f"TXN-{uuid4().hex[:8].upper()}")
    user_id: str
    subscription_id: Optional[str] = None
    
    # --- Financial Data ---
    amount: float
    currency: str = "PKR"
    payment_method: str  # jazzcash, easypaisa, card, stripe
    
    # --- Status ---
    # initiated -> pending -> success / failed / refunded
    status: str = "initiated"
    
    # --- Gateway Response ---
    # Store the raw response from the payment gateway for debugging
    gateway_response: Optional[Dict[str, Any]] = None
    receipt_url: Optional[str] = None
    
    # --- Metadata ---
    description: str = "Subscription Payment"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True