import os
import stripe
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from app.api.auth import get_current_user
from app.core.database import db_instance
from app.models.subscription import SubscriptionModel
from app.models.transaction import TransactionModel
from app.core.repository import SubscriptionRepository

router = APIRouter(prefix="/billing", tags=["Billing & Payments"])

# Configuration
STRIPE_SECRET_KEY = "sk_test_51RpocoQnTSL9YPiq9skIJ3bi94dMwGdUgc8DOGV1pd6LtoxrifeU2Kyv2gacHXjJB4ubRxMi6h1Yq0amefgwvwJa004yW91QDv"
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
stripe.api_key = STRIPE_SECRET_KEY

@router.post("/checkout")
async def create_payment(transaction: TransactionModel, current_user: dict = Depends(get_current_user)):
    """Initializes a Stripe PaymentIntent and logs the transaction."""
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(transaction.amount * 100), 
            currency=transaction.currency.lower(),
            metadata={
                "user_id": str(current_user["_id"]),
                "transaction_id": transaction.transaction_id,
                "tier": transaction.description  # Passing 'pro' or 'starter' here
            }
        )

        # Log initiated transaction to MongoDB
        transaction.user_id = str(current_user["_id"])
        transaction.status = "initiated"
        await db_instance.db.transactions.insert_one(transaction.model_dump())

        return {
            "client_secret": intent.client_secret,
            "transaction_id": transaction.transaction_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/stripe-webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """Listen for successful payments to activate features."""
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Signature")

    if event["type"] == "payment_intent.succeeded":
        payment_data = event["data"]["object"]
        meta = payment_data.get("metadata", {})
        
        user_id = meta.get("user_id")
        tier = meta.get("tier", "pro")
        txn_id = meta.get("transaction_id")

        # 1. Update Transaction status
        await db_instance.db.transactions.update_one(
            {"transaction_id": txn_id},
            {"$set": {"status": "success", "updated_at": datetime.now(timezone.utc)}}
        )

        # 2. Create/Update Subscription using Repository
        expiry = datetime.now(timezone.utc) + timedelta(days=30)
        sub_payload = {
            "user_id": user_id,
            "tier": tier,
            "status": "active",
            "expiry_date": expiry,
            "start_date": datetime.now(timezone.utc),
            "auto_renew": True
        }
        await SubscriptionRepository.create_subscription(sub_payload)
        print(f"✅ NexCareer {tier.upper()} activated for {user_id}")

    return {"status": "success"}

@router.get("/status")
async def get_my_subscription(current_user: dict = Depends(get_current_user)):
    """Check current user's plan and handle auto-expiry."""
    user_id = str(current_user["_id"])
    sub = await SubscriptionRepository.get_active_subscription(user_id)
    
    if not sub:
        return {"status": "inactive", "tier": "free"}
    
    # Check Expiry
    if sub["expiry_date"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await SubscriptionRepository.update_status(str(sub["_id"]), "expired")
        return {"status": "expired", "tier": "free"}
        
    return {
        "status": sub["status"],
        "tier": sub["tier"],
        "expiry": sub["expiry_date"]
    }
