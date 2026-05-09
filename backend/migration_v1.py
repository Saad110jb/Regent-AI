from pymongo import MongoClient

def migrate():
    client = MongoClient('mongodb://localhost:27017')
    db = client['regents_db']
    
    # 1. Migrate Analysis Records
    analysis_count = 0
    for doc in db.analysis.find({"annotated_video_url": {"$regex": "8002"}}):
        new_annotated = doc["annotated_video_url"].replace("8002", "8000")
        new_video = doc.get("video_url", "").replace("8002", "8000")
        db.analysis.update_one(
            {"_id": doc["_id"]},
            {"$set": {"annotated_video_url": new_annotated, "video_url": new_video}}
        )
        analysis_count += 1
    
    # 2. Migrate Chat Messages
    chat_count = 0
    for msg in db.messages.find({"file_url": {"$regex": "8002"}}):
        new_url = msg["file_url"].replace("8002", "8000")
        db.messages.update_one(
            {"_id": msg["_id"]},
            {"$set": {"file_url": new_url}}
        )
        chat_count += 1
        
    print(f"NEURAL_MIGRATION: Success.")
    print(f" - Analysis sessions restored: {analysis_count}")
    print(f" - Chat media links repaired: {chat_count}")

if __name__ == "__main__":
    migrate()
