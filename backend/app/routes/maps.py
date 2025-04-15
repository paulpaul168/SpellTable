from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from ..models.map import MapData
from ..core.constants import MAPS_DIR
import json
import os
import shutil
from pathlib import Path

router = APIRouter()


@router.post("/upload")
async def upload_map(file: UploadFile = File(...)):
    try:
        # Save the uploaded file
        file_path = os.path.join(MAPS_DIR, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        return {"filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{filename}")
async def get_map(filename: str):
    try:
        file_path = os.path.join(MAPS_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Map not found")
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data")
async def store_map_data(map_data: MapData):
    try:
        file_path = MAPS_DIR / f"{map_data.name}.json"
        with file_path.open("w") as f:
            json.dump(map_data.data, f)
        return {"message": f"Map '{map_data.name}' stored successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/{map_name}")
async def load_map_data(map_name: str):
    try:
        file_path = MAPS_DIR / f"{map_name}.json"
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Map not found")

        with file_path.open("r") as f:
            map_data = json.load(f)
        return {"name": map_name, "data": map_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
