import os
import uuid
import anyio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from scripts.worker import RegentsAIEngine

# 1. Initialize FastAPI
app = FastAPI(title="Regents AI Worker")

# 2. ENABLE CORS (Crucial for Mobile App Connection)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Load Engine once at startup
engine = RegentsAIEngine()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(BASE_DIR, "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)

# 4. Serve the temp_uploads folder so the backend can download the result
app.mount("/outputs", StaticFiles(directory=TEMP_DIR), name="outputs")

@app.get("/")
def read_root():
    return {"status": "Regents AI Engine Online", "mode": "Production"}

@app.post("/process-video")
async def process_video(file: UploadFile = File(...)):
    """
    Receives video, saves temporarily, runs the 4-Expert sequence, 
    and returns results.
    """
    # Validate file type
    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Invalid video format")

    temp_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(TEMP_DIR, temp_filename)
    output_path = os.path.join(TEMP_DIR, f"annotated_{temp_filename}")
    
    try:
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())

        # Execute AI Logic in a separate thread
        results = await anyio.to_thread.run_sync(
            engine.analyze_video, temp_path, output_path
        )
        
        return {
            "status": "success",
            "results": {
                **results,
                "annotated_video_url": f"outputs/annotated_{temp_filename}"
            },
            "video_id": temp_filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Cleanup original upload to save disk space
        if os.path.exists(temp_path):
            os.remove(temp_path)
        # Note: You might want to keep output_path if you plan to serve the video back

@app.get("/health")
def health():
    return {"status": "ready", "models_loaded": True}