import asyncio
from app.core.database import connect_to_mongo, db_instance

async def check():
    await connect_to_mongo()
    a = await db_instance.db.analysis.find_one({"user_id": "69f5e3ab0062e7391d1d0507"})
    if a:
        print(a)
    else:
        print("Not found")

if __name__ == "__main__":
    asyncio.run(check())
