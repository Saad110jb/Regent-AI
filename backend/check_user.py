import asyncio
from app.core.database import connect_to_mongo, db_instance
from bson import ObjectId

async def check():
    await connect_to_mongo()
    user = await db_instance.db.users.find_one({"_id": ObjectId("69f5e3ab0062e7391d1d0507")})
    if user:
        print(f"User ID: {user['_id']} | Name: {user.get('full_name')} | Role: {user.get('role')}")
    else:
        print("User not found")

if __name__ == "__main__":
    asyncio.run(check())
