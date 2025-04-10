from fastapi import APIRouter, HTTPException
from ..models.map import MapData
from ..core.config import MAPS_DIR
import json
import os

router = APIRouter()


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
