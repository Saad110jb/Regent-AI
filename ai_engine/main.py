import os
import uuid
from fastapi import FastAPI, UploadFile, File
from scripts.worker import RegentsAIEngine

app = FastAPI(title="Regents AI Worker")
engine = RegentsAIEngine()

# Use absolute paths to prevent service workspace mismatch
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(BASE_DIR, "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)

@app.post("/process-video")
async def process_video(file: UploadFile = File(...)):
    """
    Receives video bytes and runs the 4-Expert sequence.
    Returns raw ball path, biomechanics, and shot metrics.
    """
    temp_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.abspath(os.path.join(TEMP_DIR, temp_filename))
    output_path = os.path.abspath(os.path.join(TEMP_DIR, f"annotated_{temp_filename}"))
    
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        # Executes: Bowler Detect -> Skeleton -> Ball Track
        # Run in a separate thread to avoid blocking the event loop
        import anyio
        results = await anyio.to_thread.run_sync(engine.analyze_video, temp_path, output_path)
        
        return results 
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/health")
def health():
    return {"status": "AI Engine Ready", "models_loaded": True}