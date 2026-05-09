import asyncio
from app.core.database import connect_to_mongo, db_instance
from bson import ObjectId

async def check():
    await connect_to_mongo()
    team = await db_instance.db.teams.find_one({"_id": ObjectId("69f75432608f80cc4d068593")})
    if team:
        print(team)
    else:
        print("Not found")

if __name__ == "__main__":
    asyncio.run(check())
