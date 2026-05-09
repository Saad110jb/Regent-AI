from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

class MongoDB:
    """Manages the MongoDB lifecycle."""
    client: AsyncIOMotorClient = None
    db = None

# Global instance to be used across the app
db_instance = MongoDB()

async def connect_to_mongo():
    # Fetch values, providing defaults to prevent NoneType errors
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "regents_db") # Default added here
    
    db_instance.client = AsyncIOMotorClient(mongo_url)
    db_instance.db = db_instance.client[db_name] # This line was failing
    
    print(f"Connected to MongoDB: {db_name}")

async def close_mongo_connection():
    """Closes the database connection gracefully."""
    if db_instance.client:
        db_instance.client.close()
        print("MongoDB connection closed.")