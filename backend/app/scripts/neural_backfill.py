import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId
import sys

# Add the app directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

load_dotenv()

from app.core.advisory import NeuralCoach
from app.core.repository import AnalysisRepository

async def backfill_neural_insights():
    print("🚀 INITIATING NEURAL BACKFILL...")
    
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DATABASE_NAME", "regents_db")]
    
    # Find sessions that don't have the deep tactical report (Neural Advisory)
    # We look for ANY session that doesn't explicitly contain the tag
    cursor = db.analysis.find({
        "ai_suggestions": {"$not": {"$regex": "NEURAL ADVISORY REPORT"}}
    })
    
    sessions = await cursor.to_list(length=100)
    print(f"🔍 Found {len(sessions)} sessions requiring neural enrichment.")
    
    for session in sessions:
        try:
            player_name = session.get("player_name", "Operative")
            user_id = session.get("user_id")
            metrics = session.get("metrics", {})
            
            print(f"🧠 Analyzing session for {player_name}...")
            
            # Fetch history for context
            history = await AnalysisRepository.get_user_performance_history(user_id, limit=5)
            
            # Generate the deep report
            ai_report = await NeuralCoach.get_coaching_report(
                player_name=player_name,
                current_metrics=metrics,
                history=history
            )
            
            # Update the record
            current_insights = session.get("ai_suggestions", [])
            # Filter out any old attempts to keep it clean
            current_insights = [i for i in current_insights if "NEURAL ADVISORY" not in i]
            
            enriched_insights = current_insights + ["\n--- NEURAL ADVISORY REPORT ---", ai_report]
            
            await db.analysis.update_one(
                {"_id": session["_id"]},
                {"$set": {"ai_suggestions": enriched_insights}}
            )
            print(f"✅ Enriched: {session.get('video_id')}")
            
            # THROTTLING: Wait 5 seconds between sessions to avoid 429 quota errors
            print("⏳ Cooling down Neural Engine (5s)...")
            await asyncio.sleep(5)
            
        except Exception as e:
            print(f"❌ Failed to enrich session {session.get('_id')}: {e}")

    print("\n✨ NEURAL BACKFILL COMPLETE. Refresh your dashboards to see the insights!")

if __name__ == "__main__":
    asyncio.run(backfill_neural_insights())
