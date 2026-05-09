import asyncio
from app.core.database import connect_to_mongo, db_instance

async def check():
    await connect_to_mongo()
    cursor = db_instance.db.analysis.find().sort("created_at", -1).limit(1)
    analyses = await cursor.to_list(length=1)
    if analyses:
        print(analyses[0])
    else:
        print("Empty collection")

if __name__ == "__main__":
    asyncio.run(check())
