import asyncio
from app.core.database import connect_to_mongo, db_instance

async def check():
    await connect_to_mongo()
    cursor = db_instance.db.analysis.find().sort("created_at", -1).limit(5)
    analyses = await cursor.to_list(length=5)
    for a in analyses:
        print(f"URL: {a.get('annotated_video_url')} | Created: {a.get('created_at')}")

if __name__ == "__main__":
    asyncio.run(check())
