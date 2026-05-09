import asyncio
from app.core.database import connect_to_mongo, db_instance

async def check():
    await connect_to_mongo()
    cursor = db_instance.db.analysis.find({"player_name": "SAAD11"})
    analyses = await cursor.to_list(length=5)
    for a in analyses:
        print(a)

if __name__ == "__main__":
    asyncio.run(check())
