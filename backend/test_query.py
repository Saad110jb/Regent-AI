import asyncio
from app.core.database import connect_to_mongo, db_instance
from datetime import datetime, timedelta

async def check():
    await connect_to_mongo()
    cutoff = datetime.utcnow() - timedelta(hours=24)
    player_user_ids = ['69f757de26c20fe6119d7640', '69ff218ba7e4903aca81f9c6']
    
    cursor = db_instance.db.analysis.find({
        "$or": [
            {"user_id": {"$in": player_user_ids}},
            {"player_id": {"$in": player_user_ids}}
        ],
        "created_at": {"$gte": cutoff}
    }).sort("created_at", -1)
    
    results = await cursor.to_list(length=50)
    print(f"Found {len(results)} records")
    for r in results:
        print(f"ID: {r['_id']} | PlayerID: {r.get('player_id')} | UserID: {r.get('user_id')} | Created: {r.get('created_at')}")

if __name__ == "__main__":
    asyncio.run(check())
