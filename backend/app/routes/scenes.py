from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import json
import os
from ..core.constants import SCENES_DIR
import uuid

router = APIRouter()


# Define the scene data model
class SceneData(BaseModel):
    id: str
    name: str
    maps: List[Dict]
    activeMapId: Optional[str] = None
    gridSettings: Dict = {"showGrid": True, "gridSize": 50}
    initiativeOrder: List[Dict] = []
    showCurrentPlayer: bool = True


@router.post("/save")
async def save_scene(scene: SceneData):
    try:
        scene.id = str(uuid.uuid4())
        # Save the scene to a file with its ID
        scene_file = os.path.join(SCENES_DIR, f"{scene.id}.json")
        with open(scene_file, "w") as f:
            json.dump(scene.dict(), f)
        return {"message": "Scene saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_scenes():
    try:
        scenes = []
        for filename in os.listdir(SCENES_DIR):
            if filename.endswith(".json"):
                file_path = os.path.join(SCENES_DIR, filename)
                with open(file_path, "r") as f:
                    scene_data = json.load(f)
                    scenes.append(scene_data)
        return scenes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/load/{scene_id}")
async def load_scene(scene_id: str):
    try:
        # Load the scene from file
        scene_file = os.path.join(SCENES_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            raise HTTPException(status_code=404, detail="Scene not found")

        with open(scene_file, "r") as f:
            scene_data = json.load(f)
        return scene_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{scene_id}")
async def delete_scene(scene_id: str):
    try:
        # Delete the scene file
        scene_file = os.path.join(SCENES_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            raise HTTPException(status_code=404, detail="Scene not found")

        os.remove(scene_file)
        return {"message": "Scene deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{scene_id}")
async def update_scene(scene_id: str, scene: SceneData):
    try:
        # Update the scene file
        scene_file = os.path.join(SCENES_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            raise HTTPException(status_code=404, detail="Scene not found")

        with open(scene_file, "w") as f:
            json.dump(scene.dict(), f)
        return {"message": "Scene updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
