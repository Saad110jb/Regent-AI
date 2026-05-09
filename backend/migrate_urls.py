import asyncio
from app.core.database import connect_to_mongo, db_instance
from bson import ObjectId

async def migrate():
    await connect_to_mongo()
    
    # Update Chat Messages
    messages_cursor = db_instance.db.messages.find({"file_url": {"$regex": "8000"}})
    messages = await messages_cursor.to_list(length=1000)
    updated_msg = 0
    for msg in messages:
        old_url = msg["file_url"]
        new_url = old_url.replace("192.168.110.106:8000", "localhost:8002").replace(":8000", ":8002")
        await db_instance.db.messages.update_one({"_id": msg["_id"]}, {"$set": {"file_url": new_url}})
        updated_msg += 1
        
    # Update Analysis History
    analysis_cursor = db_instance.db.analysis.find({"annotated_video_url": {"$regex": "8000"}})
    analyses = await analysis_cursor.to_list(length=1000)
    updated_ana = 0
    for ana in analyses:
        old_url = ana["annotated_video_url"]
        new_url = old_url.replace("192.168.110.106:8000", "localhost:8002").replace(":8000", ":8002")
        await db_instance.db.analysis.update_one({"_id": ana["_id"]}, {"$set": {"annotated_video_url": new_url}})
        updated_ana += 1
        
    print(f"MIGRATION_COMPLETE: Updated {updated_msg} chat assets and {updated_ana} analysis videos.")

if __name__ == "__main__":
    asyncio.run(migrate())
