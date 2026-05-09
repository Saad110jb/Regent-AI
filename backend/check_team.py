import asyncio
from app.core.database import connect_to_mongo, db_instance

async def check():
    await connect_to_mongo()
    team = await db_instance.db.teams.find_one({"coach_id": "69f5e3ab0062e7391d1d0507"})
    if team:
        print(f"Team ID: {team['_id']} | Players: {team.get('player_ids')}")
    else:
        print("Team not found")

if __name__ == "__main__":
    asyncio.run(check())
