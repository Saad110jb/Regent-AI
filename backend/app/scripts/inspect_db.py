import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import json

load_dotenv()

async def inspect_analysis():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DATABASE_NAME", "regents_db")]
    
    session = await db.analysis.find_one({})
    if session:
        # Convert ObjectId to string for JSON
        session["_id"] = str(session["_id"])
        print(json.dumps(session, indent=2))
    else:
        print("No sessions found.")

if __name__ == "__main__":
    asyncio.run(inspect_analysis())
