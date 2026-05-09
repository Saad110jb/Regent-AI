import asyncio
from datetime import datetime, timedelta, timezone
from app.core.database import db_instance
from bson import ObjectId

async def run_chat_retention_purge():
    """
    Background job to purge messages based on team retention policies.
    Runs every hour to ensure neural efficiency.
    """
    while True:
        try:
            # Wait for DB connection to be ready (if called too early)
            if not hasattr(db_instance, "db") or db_instance.db is None:
                await asyncio.sleep(5)
                continue

            print("[CHAT_CLEANUP] Starting neural purge sequence...")
            
            # 1. Get all teams with an active retention policy
            teams_cursor = db_instance.db.teams.find({
                "chat_settings.retention_period": {"$ne": "Never"}
            })
            
            async for team in teams_cursor:
                team_id = str(team["_id"])
                policy = team.get("chat_settings", {}).get("retention_period", "Never")
                
                now = datetime.now(timezone.utc)
                if policy == "24 Hours":
                    cutoff = now - timedelta(hours=24)
                elif policy == "1 Week":
                    cutoff = now - timedelta(weeks=1)
                elif policy == "1 Month":
                    cutoff = now - timedelta(days=30)
                else:
                    continue
                
                # 2. Hard delete messages from database
                result = await db_instance.db.messages.delete_many({
                    "team_id": team_id,
                    "timestamp": {"$lt": cutoff}
                })
                
                if result.deleted_count > 0:
                    print(f"[CHAT_CLEANUP] Purged {result.deleted_count} messages for Team {team_id} (Policy: {policy})")
            
            print("[CHAT_CLEANUP] Purge sequence complete.")
            
        except Exception as e:
            print(f"[CHAT_CLEANUP_CRITICAL_FAILURE] {e}")
            
        # Run the cycle every hour
        await asyncio.sleep(3600)
