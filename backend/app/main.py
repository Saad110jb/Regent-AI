from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api import auth, player, team, subscription, plan, video, billing, settings, analysis, chat

from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="Regents AI API")

# Mount static files to serve processed AI videos
app.mount("/static", StaticFiles(directory="static"), name="static")



# --- Neural Gateway Initialization ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection management
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo() 
    
    # Start the 24-hour Neural Scrubber in the background
    import asyncio
    from app.core.cleanup import run_periodic_cleanup
    from app.core.chat_cleanup import run_chat_retention_purge
    from app.scripts.neural_backfill import backfill_neural_insights
    
    asyncio.create_task(run_periodic_cleanup())
    asyncio.create_task(run_chat_retention_purge())
    asyncio.create_task(backfill_neural_insights())

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection() #

# Include Routers
app.include_router(auth.router) #
app.include_router(player.router) #
app.include_router(team.router) #
app.include_router(subscription.router) #
app.include_router(plan.router) # Register the plans router
app.include_router(video.router) # Register the videos router
app.include_router(billing.router) # Register the billing router
app.include_router(settings.router)
app.include_router(analysis.router) # Register the analysis router
app.include_router(chat.router)
@app.get("/health")
async def health():
    return {"status": "Online", "database": "Connected"}