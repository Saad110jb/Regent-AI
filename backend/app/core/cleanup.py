import os
import time
from datetime import datetime, timedelta, timezone

def scrub_expired_videos(directory: str, max_age_hours: int = 24):
    """
    Scans the specified directory and deletes files older than the max_age_hours.
    """
    if not os.path.exists(directory):
        print(f"CLEANUP_SYSTEM: Directory {directory} not found. Skipping.")
        return

    now = time.time()
    cutoff = now - (max_age_hours * 3600)
    count = 0

    for filename in os.listdir(directory):
        filepath = os.path.join(directory, filename)
        if os.path.isfile(filepath):
            file_mtime = os.path.getmtime(filepath)
            if file_mtime < cutoff:
                try:
                    os.remove(filepath)
                    count += 1
                except Exception as e:
                    print(f"CLEANUP_ERROR: Failed to delete {filename}: {e}")

    if count > 0:
        print(f"CLEANUP_SYSTEM: Successfully purged {count} expired operative files from {directory}.")

async def scrub_expired_invitations(max_age_hours: int = 24):
    """
    Scans the database and removes invitations older than the max age.
    """
    from app.core.database import db_instance
    
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    
    # Remove invitations where created_at is older than cutoff
    # This uses MongoDB's $pull with a condition on the array elements
    result = await db_instance.db.players.update_many(
        {},
        {"$pull": {"invitations": {"created_at": {"$lt": cutoff}}}}
    )
    
    if result.modified_count > 0:
        print(f"CLEANUP_SYSTEM: Successfully purged {result.modified_count} expired squad invitations.")

async def run_periodic_cleanup():
    """
    Background loop that runs every hour to keep the storage and DB clean.
    """
    import asyncio
    while True:
        print("CLEANUP_SYSTEM: Initiating 24-hour neural purge...")
        
        # 1. Clean physical storage
        scrub_expired_videos("static/uploads")
        scrub_expired_videos("static/annotated")
        scrub_expired_videos("static/chat_assets") # Also clean chat assets
        
        # 2. Clean database records
        await scrub_expired_invitations()
        
        # Run every hour
        await asyncio.sleep(3600)
