# /// script
# dependencies = [
#   "motor",
#   "pydantic",
#   "email-validator",
# ]
# ///

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# --- Configuration ---
MONGO_DETAILS = "mongodb://localhost:27017" 
DB_NAME = "regents_db"

def get_seed_data():
    # Helper IDs to link Users to Players
    u_id_1 = "65e1f1a1b2c3d4e5f6000001"
    u_id_2 = "65e1f1a1b2c3d4e5f6000002"
    u_id_3 = "65e1f1a1b2c3d4e5f6000003"

    plans = [
        {"plan_id": "free_tier", "name": "Regents Free", "price": 0.0, "currency": "PKR", "interval": "lifetime", "is_active": True},
        {"plan_id": "pro_monthly", "name": "Regents Pro", "price": 1500.0, "currency": "PKR", "interval": "month", "is_active": True},
        {"plan_id": "academy_yearly", "name": "Academy Elite", "price": 12000.0, "currency": "PKR", "interval": "year", "is_active": True}
    ]

    users = [
        {
            "_id": u_id_1,
            "full_name": "Babar Azam",
            "email": "babar.azam@cric-ai.com",
            "role": "player",
            "location": "Lahore",
            "is_active": True,
            "subscription_tier": "pro_monthly",
            "hashed_password": "Hashed_Safe_123",
            "primary_skill": "batsman",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "_id": u_id_2,
            "full_name": "Shaheen Afridi",
            "email": "shaheen.a@cric-ai.com",
            "role": "player",
            "location": "Peshawar",
            "is_active": True,
            "subscription_tier": "pro_monthly",
            "hashed_password": "Hashed_Safe_456",
            "primary_skill": "bowler",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "_id": u_id_3,
            "full_name": "Shadab Khan",
            "email": "shadab.k@cric-ai.com",
            "role": "player",
            "location": "Faisalabad",
            "is_active": True,
            "subscription_tier": "free_tier",
            "hashed_password": "Hashed_Safe_789",
            "primary_skill": "all-rounder",
            "created_at": datetime.now(timezone.utc)
        }
    ]

    players = [
        {
            "user_id": u_id_1,
            "team_id": None,
            "player_type": "batsman",
            "batting_style": "right-hand",
            "bowling_style": "off-break",
            "jersey_number": 56,
            "performance_stats": {
                "total_runs": 5400, "highest_score": 122, "batting_average": 51.4,
                "strike_rate": 134.2, "wickets": 0, "best_bowling_figures": "0/0",
                "economy_rate": 0.0, "top_speed_kph": 0.0
            },
            "achievements": ["ICC Player of the Year", "Captain of Pakistan"]
        },
        {
            "user_id": u_id_2,
            "team_id": None,
            "player_type": "bowler",
            "batting_style": "left-hand",
            "bowling_style": "left-arm-fast",
            "jersey_number": 10,
            "performance_stats": {
                "total_runs": 450, "highest_score": 35, "batting_average": 14.5,
                "strike_rate": 115.0, "wickets": 255, "best_bowling_figures": "6/35",
                "economy_rate": 5.2, "top_speed_kph": 151.2
            },
            "achievements": ["Fastest 100 Wickets in ODIs"]
        },
        {
            "user_id": u_id_3,
            "team_id": None,
            "player_type": "all-rounder",
            "batting_style": "right-hand",
            "bowling_style": "leg-spin",
            "jersey_number": 7,
            "performance_stats": {
                "total_runs": 1200, "highest_score": 85, "batting_average": 28.2,
                "strike_rate": 142.1, "wickets": 190, "best_bowling_figures": "4/15",
                "economy_rate": 7.4, "top_speed_kph": 98.5
            },
            "achievements": ["Best All-rounder 2023", "Faisalabad Cup Winner"]
        }
    ]
    return plans, users, players

async def run_seed():
    print("🚀 Initializing Database Seed...")
    client = AsyncIOMotorClient(MONGO_DETAILS)
    db = client[DB_NAME]
    
    plans, users, players = get_seed_data()

    # 1. Seed Plans
    for p in plans:
        await db.plans.update_one({"plan_id": p["plan_id"]}, {"$set": p}, upsert=True)
    print("✅ Plans Synced")

    # 2. Seed Users
    for u in users:
        await db.users.update_one({"_id": u["_id"]}, {"$set": u}, upsert=True)
    print("✅ Users Synced")

    # 3. Seed Players
    for pl in players:
        await db.players.update_one({"user_id": pl["user_id"]}, {"$set": pl}, upsert=True)
    print("✅ Players Synced")

    print("\n✨ All systems go. Seed complete.")
    client.close()

if __name__ == "__main__":
    asyncio.run(run_seed())