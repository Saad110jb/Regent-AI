import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os

# --- Configuration ---
# Match these with your existing .env or database config
MONGO_DETAILS = "mongodb://localhost:27017" 
DB_NAME = "regents_db"

async def initialize_plans():
    print("🚀 Starting Plan Initialization...")
    client = AsyncIOMotorClient(MONGO_DETAILS)
    db = client[DB_NAME]
    plans_collection = db["plans"]

    # 1. Define the Default Plans
    default_plans = [
        {
            "plan_id": "free_tier",
            "name": "Regents Free",
            "description": "Essential stats for local players.",
            "price": 0.0,
            "currency": "PKR",
            "interval": "lifetime",
            "is_active": True,
            "is_popular": False,
            "features": [
                {"name": "Basic Profile", "is_available": True},
                {"name": "AI Speed Tracking", "is_available": True, "limit": 5},
                {"name": "Team Joining", "is_available": True},
                {"name": "Advanced Analytics", "is_available": False}
            ]
        },
        {
            "plan_id": "pro_monthly",
            "name": "Regents Pro",
            "description": "Full AI analysis for serious athletes.",
            "price": 1500.0,
            "currency": "PKR",
            "interval": "month",
            "is_active": True,
            "is_popular": True,
            "features": [
                {"name": "Unlimited AI Analysis", "is_available": True},
                {"name": "Detailed Performance Reports", "is_available": True},
                {"name": "Video Storage", "is_available": True, "limit": 50},
                {"name": "Priority Support", "is_available": True}
            ]
        },
        {
            "plan_id": "academy_yearly",
            "name": "Academy Elite",
            "description": "Complete squad management for clubs and academies.",
            "price": 12000.0,
            "currency": "PKR",
            "interval": "year",
            "is_active": True,
            "is_popular": False,
            "features": [
                {"name": "Multi-Player Tracking", "is_available": True},
                {"name": "Coach Dashboards", "is_available": True},
                {"name": "Unlimited Video Storage", "is_available": True},
                {"name": "Custom Branding", "is_available": True}
            ]
        }
    ]

    # 2. Insert Data
    for plan in default_plans:
        # We use update_one with upsert=True to avoid creating duplicates 
        # if you run the script multiple times.
        await plans_collection.update_one(
            {"plan_id": plan["plan_id"]},
            {"$set": plan},
            upsert=True
        )
        print(f"✅ Synced Plan: {plan['name']}")

    print("\n✨ Database initialization complete! You can now use these plans in the API.")
    client.close()

if __name__ == "__main__":
    asyncio.run(initialize_plans())