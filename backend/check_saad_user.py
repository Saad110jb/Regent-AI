import asyncio
from app.core.database import connect_to_mongo, db_instance
from bson import ObjectId

async def check():
    await connect_to_mongo()
    u = await db_instance.db.users.find_one({"_id": ObjectId("69ff218ba7e4903aca81f9c6")})
    if u:
        print(f"Name: {u.get('full_name')}")
    else:
        print("Not found")

if __name__ == "__main__":
    asyncio.run(check())
