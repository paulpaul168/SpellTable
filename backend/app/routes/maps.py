from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from ..models.map import MapData
from ..core.config import MAPS_DIR
import json
import os
import shutil
from pathlib import Path

router = APIRouter()

# Create maps directory if it doesn't exist
MAPS_DIR = Path("maps")
MAPS_DIR.mkdir(exist_ok=True)


@router.post("/maps")
async def store_map(map_data: MapData):
    try:
        file_path = os.path.join(MAPS_DIR, f"{map_data.name}.json")
        with open(file_path, "w") as f:
            json.dump(map_data.data, f)
        return {"message": f"Map '{map_data.name}' stored successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maps/{map_name}")
async def load_map(map_name: str):
    try:
        file_path = os.path.join(MAPS_DIR, f"{map_name}.json")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Map not found")

        with open(file_path, "r") as f:
            map_data = json.load(f)
        return {"name": map_name, "data": map_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/maps/upload")
async def upload_map(file: UploadFile = File(...)):
    try:
        # Ensure file is an image
        if not file.content_type.startswith("image/"):
            return JSONResponse(
                status_code=400, content={"error": "File must be an image"}
            )

        # Create a safe filename
        filename = Path(file.filename).stem
        extension = Path(file.filename).suffix
        safe_filename = f"{filename}{extension}".replace(" ", "_")
        file_path = MAPS_DIR / safe_filename

        # Save the file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {"filename": safe_filename, "content_type": file.content_type}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
