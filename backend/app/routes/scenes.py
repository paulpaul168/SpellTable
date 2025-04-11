from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import json
import os
from ..core.constants import SCENES_DIR

router = APIRouter()


# Define the scene data model
class SceneData(BaseModel):
    maps: List[Dict]
    activeMapId: Optional[str] = None


@router.post("/save")
async def save_scene(scene: SceneData):
    try:
        # Save the scene to a file
        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
        with open(scene_file, "w") as f:
            json.dump(scene.dict(), f)
        return {"message": "Scene saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/load")
async def load_scene():
    try:
        # Load the scene from file
        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
        if not os.path.exists(scene_file):
            raise HTTPException(status_code=404, detail="No saved scene found")

        with open(scene_file, "r") as f:
            scene_data = json.load(f)
        return scene_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
