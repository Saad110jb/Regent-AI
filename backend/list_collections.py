import asyncio
from app.core.database import connect_to_mongo, db_instance

async def check():
    await connect_to_mongo()
    cols = await db_instance.db.list_collection_names()
    print(cols)

if __name__ == "__main__":
    asyncio.run(check())
