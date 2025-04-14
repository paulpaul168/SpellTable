from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import json
import os
from ..core.constants import SCENES_DIR
import uuid
import shutil

router = APIRouter()


# Define the scene data model
class SceneData(BaseModel):
    id: str
    name: str
    folder: Optional[str] = None
    maps: List[Dict]
    activeMapId: Optional[str] = None
    gridSettings: Dict = {"showGrid": True, "gridSize": 50}
    initiativeOrder: List[Dict] = []
    showCurrentPlayer: bool = True


class FolderCreateRequest(BaseModel):
    folder_name: str


@router.post("/save")
async def save_scene(scene: SceneData):
    try:
        scene.id = str(uuid.uuid4())
        # Create folder if it doesn't exist
        if scene.folder:
            folder_path = os.path.join(SCENES_DIR, scene.folder)
            os.makedirs(folder_path, exist_ok=True)
            scene_file = os.path.join(folder_path, f"{scene.id}.json")
        else:
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
        folders = []

        # First, get all folders
        for item in os.listdir(SCENES_DIR):
            item_path = os.path.join(SCENES_DIR, item)
            if os.path.isdir(item_path) and item != "__pycache__":
                folders.append({"name": item, "type": "folder", "path": item})

        # Then get all scenes in root directory
        for filename in os.listdir(SCENES_DIR):
            if filename.endswith(".json") and filename != "current_scene.json":
                file_path = os.path.join(SCENES_DIR, filename)
                with open(file_path, "r") as f:
                    scene_data = json.load(f)
                    scenes.append(scene_data)

        # Get scenes from each folder
        for folder in folders:
            folder_path = os.path.join(SCENES_DIR, folder["name"])
            for filename in os.listdir(folder_path):
                if filename.endswith(".json"):
                    file_path = os.path.join(folder_path, filename)
                    with open(file_path, "r") as f:
                        scene_data = json.load(f)
                        scenes.append(scene_data)

        return {"folders": folders, "scenes": scenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/folder")
async def create_folder(request: FolderCreateRequest):
    try:
        folder_path = os.path.join(SCENES_DIR, request.folder_name)
        if os.path.exists(folder_path):
            raise HTTPException(status_code=400, detail="Folder already exists")
        os.makedirs(folder_path)
        return {"message": "Folder created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/folder/{folder_name}")
async def delete_folder(folder_name: str):
    try:
        folder_path = os.path.join(SCENES_DIR, folder_name)
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=404, detail="Folder not found")
        shutil.rmtree(folder_path)
        return {"message": "Folder deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/load/{scene_id}")
async def load_scene(scene_id: str):
    try:
        # First check in root directory
        scene_file = os.path.join(SCENES_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            # If not found, search in all folders
            for folder in os.listdir(SCENES_DIR):
                folder_path = os.path.join(SCENES_DIR, folder)
                if os.path.isdir(folder_path):
                    scene_file = os.path.join(folder_path, f"{scene_id}.json")
                    if os.path.exists(scene_file):
                        break
            else:
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
        # First check in root directory
        scene_file = os.path.join(SCENES_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            # If not found, search in all folders
            for folder in os.listdir(SCENES_DIR):
                folder_path = os.path.join(SCENES_DIR, folder)
                if os.path.isdir(folder_path):
                    scene_file = os.path.join(folder_path, f"{scene_id}.json")
                    if os.path.exists(scene_file):
                        break
            else:
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
        # First check in root directory
        scene_file = os.path.join(SCENES_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            # If not found, search in all folders
            for folder in os.listdir(SCENES_DIR):
                folder_path = os.path.join(SCENES_DIR, folder)
                if os.path.isdir(folder_path):
                    scene_file = os.path.join(folder_path, f"{scene_id}.json")
                    if os.path.exists(scene_file):
                        break
            else:
                raise HTTPException(status_code=404, detail="Scene not found")

        # If scene is being moved to a different folder
        if scene.folder:
            new_folder_path = os.path.join(SCENES_DIR, scene.folder)
            os.makedirs(new_folder_path, exist_ok=True)
            new_scene_file = os.path.join(new_folder_path, f"{scene_id}.json")
            if scene_file != new_scene_file:
                shutil.move(scene_file, new_scene_file)
                scene_file = new_scene_file

        with open(scene_file, "w") as f:
            json.dump(scene.dict(), f)
        return {"message": "Scene updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
