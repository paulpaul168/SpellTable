"""
This module contains the scenes routes for the FastAPI app.
"""

import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Union

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from loguru import logger

from ..core.constants import SCENES_DIR
from ..models.scenes import FolderCreateRequest, FolderRenameRequest, SceneData

router = APIRouter()


@router.post("/save")
async def save_scene(scene: SceneData) -> dict[str, str]:
    """
    Save a scene.
    """
    try:
        scene.id = str(uuid.uuid4())
        # Create folder if it doesn't exist
        if scene.folder:
            folder_path = os.path.join(SCENES_DIR, scene.folder)
            os.makedirs(folder_path, exist_ok=True)
            scene_file = os.path.join(folder_path, f"{scene.id}.json")
        else:
            scene_file = os.path.join(SCENES_DIR, f"{scene.id}.json")

        with open(file=scene_file, mode="w", encoding="utf-8") as f:
            json.dump(scene.model_dump(), f)
        return {"message": "Scene saved successfully"}
    except Exception as e:
        logger.exception(f"Error saving scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/list")
async def list_scenes() -> dict[str, Any]:
    """
    List all scenes.
    """
    try:
        scenes: list[dict[str, Any]] = []
        folders: list[dict[str, Any]] = []

        def scan_directory(path: Union[str, Path], parent_path: str = "") -> None:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                relative_path = os.path.join(parent_path, item) if parent_path else item

                if os.path.isdir(item_path) and item != "__pycache__":
                    folders.append(
                        {
                            "name": item,
                            "type": "folder",
                            "path": relative_path,
                            "parent": parent_path,
                        }
                    )
                    scan_directory(item_path, relative_path)
                elif item.endswith(".json") and item != "current_scene.json":
                    with open(file=item_path, mode="r", encoding="utf-8") as f:
                        scene_data = json.load(f)
                        scenes.append(scene_data)

        scan_directory(SCENES_DIR)
        return {"folders": folders, "scenes": scenes}
    except Exception as e:
        logger.exception(f"Error listing scenes: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/folder")
async def create_folder(request: FolderCreateRequest) -> dict[str, str]:
    """
    Create a folder.
    """
    try:
        if request.parent_folder:
            folder_path = os.path.join(SCENES_DIR, request.parent_folder, request.folder_name)
        else:
            folder_path = os.path.join(SCENES_DIR, request.folder_name)

        if os.path.exists(folder_path):
            raise HTTPException(status_code=400, detail="Folder already exists")
        os.makedirs(folder_path)
        return {"message": "Folder created successfully"}
    except Exception as e:
        logger.exception(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/folder/{folder_path:path}")
async def delete_folder(folder_path: str) -> dict[str, str]:
    """
    Delete a folder.
    """
    try:
        folder_path = os.path.join(SCENES_DIR, folder_path)
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=404, detail="Folder not found")
        shutil.rmtree(folder_path)
        return {"message": "Folder deleted successfully"}
    except Exception as e:
        logger.exception(f"Error deleting folder: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/load/{scene_id}")
async def load_scene(scene_id: str) -> dict[str, Any]:
    """
    Load a scene.
    """
    try:
        # First get the scene data to find its folder
        scene_data = None
        # scene_file = None

        # Search through all scenes to find the one with matching ID
        for root, _, files in os.walk(SCENES_DIR):
            for file in files:
                if file.endswith(".json") and file != "current_scene.json":
                    file_path = os.path.join(root, file)
                    with open(file=file_path, mode="r", encoding="utf-8") as f:
                        data: dict[str, Any] = json.load(f)
                        if data["id"] == scene_id:
                            scene_data = data
                            # scene_file = file_path
                            break
            if scene_data:
                break

        if not scene_data:
            raise HTTPException(status_code=404, detail="Scene not found")

        return scene_data
    except HTTPException as e:
        logger.exception(f"HTTPException in load_scene: {e}")
        raise
    except Exception as e:
        logger.exception(f"Error in load_scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{scene_id}")
async def delete_scene(scene_id: str) -> dict[str, str]:
    """
    Delete a scene.
    """
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
    except HTTPException as e:
        logger.exception(f"HTTPException in delete_scene: {e}")
        raise
    except Exception as e:
        logger.exception(f"Error in delete_scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/{scene_id}")
async def update_scene(scene_id: str, scene: SceneData) -> dict[str, str]:
    """
    Update a scene.
    """
    try:
        # Search through all directories to find the scene file
        scene_file = None
        for root, _, files in os.walk(SCENES_DIR):
            for file in files:
                if file.endswith(".json") and file != "current_scene.json":
                    file_path = os.path.join(root, file)
                    with open(file=file_path, mode="r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data["id"] == scene_id:
                            scene_file = file_path
                            break
            if scene_file:
                break

        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        # If scene is being moved to a different folder
        if scene.folder:
            new_folder_path = os.path.join(SCENES_DIR, scene.folder)
            os.makedirs(new_folder_path, exist_ok=True)
            new_scene_file = os.path.join(new_folder_path, f"{scene_id}.json")
            if scene_file != new_scene_file:
                shutil.move(scene_file, new_scene_file)
                scene_file = new_scene_file

        with open(file=scene_file, mode="w", encoding="utf-8") as f:
            json.dump(scene.dict(), f)
        return {"message": "Scene updated successfully"}
    except HTTPException as e:
        logger.exception(f"HTTPException in update_scene: {e}")
        raise
    except Exception as e:
        logger.exception(f"Error in update_scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{scene_id}/image")
async def upload_scene_image(scene_id: str, file: UploadFile = File(...)) -> dict[str, str]:
    """
    Upload a scene image.
    """
    try:
        # Find the scene file
        scene_file = None
        for root, _, files in os.walk(SCENES_DIR):
            for f in files:
                if f == f"{scene_id}.json":
                    scene_file = os.path.join(root, f)
                    break
            if scene_file:
                break

        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        # Create images directory if it doesn't exist
        scene_dir = os.path.dirname(scene_file)
        images_dir = os.path.join(scene_dir, "images")
        os.makedirs(images_dir, exist_ok=True)

        # Save the image
        image_id = str(uuid.uuid4())
        image_path = os.path.join(images_dir, f"{image_id}_{file.filename}")
        file_content = await file.read()
        with open(image_path, "wb") as buffer:
            buffer.write(file_content)

        # Update scene data
        with open(file=scene_file, mode="r", encoding="utf-8") as buffer:
            scene_data = json.load(buffer)

        scene_data["images"].append(
            {
                "id": image_id,
                "name": file.filename,
                "path": os.path.relpath(image_path, SCENES_DIR),
            }
        )

        with open(file=scene_file, mode="w", encoding="utf-8") as buffer:
            json.dump(scene_data, buffer)

        return {"message": "Image uploaded successfully", "image_id": image_id}
    except Exception as e:
        logger.exception(f"Error in upload_scene_image: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/image/{image_path:path}")
async def get_scene_image(image_path: str) -> FileResponse:
    """
    Get a scene image.
    """
    try:
        file_path = os.path.join(SCENES_DIR, image_path)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Image not found")
        return FileResponse(file_path)
    except Exception as e:
        logger.exception(f"Error in get_scene_image: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{scene_id}/image/{image_id}")
async def delete_scene_image(scene_id: str, image_id: str) -> dict[str, str]:
    """
    Delete a scene image.
    """
    try:
        # Find the scene file
        scene_file = None
        for root, _, files in os.walk(SCENES_DIR):
            for f in files:
                if f == f"{scene_id}.json":
                    scene_file = os.path.join(root, f)
                    break
            if scene_file:
                break

        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        # Update scene data and delete image
        with open(file=scene_file, mode="r", encoding="utf-8") as buffer:
            scene_data = json.load(buffer)

        image_to_delete = None
        for image in scene_data["images"]:
            if image["id"] == image_id:
                image_to_delete = image
                break

        if not image_to_delete:
            raise HTTPException(status_code=404, detail="Image not found")

        # Delete the image file
        image_path = os.path.join(SCENES_DIR, image_to_delete["path"])
        if os.path.exists(image_path):
            os.remove(image_path)

        # Update scene data
        scene_data["images"] = [img for img in scene_data["images"] if img["id"] != image_id]
        with open(file=scene_file, mode="w", encoding="utf-8") as buffer:
            json.dump(scene_data, buffer)

        return {"message": "Image deleted successfully"}
    except Exception as e:
        logger.exception(f"Error in delete_scene_image: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/folder/{folder_path:path}")
async def rename_folder(folder_path: str, request: FolderRenameRequest) -> dict[str, str]:
    """Rename a folder in the scenes directory."""
    try:
        # Ensure folder exists
        old_path = os.path.join(SCENES_DIR, folder_path)
        if not os.path.exists(old_path):
            raise HTTPException(status_code=404, detail="Folder not found")

        # Get parent path and construct new path
        parent_dir = os.path.dirname(old_path)
        new_path = os.path.join(parent_dir, request.new_name)

        # Check if destination exists
        if os.path.exists(new_path):
            raise HTTPException(
                status_code=400,
                detail=f"A folder named '{request.new_name}' already exists",
            )

        # Rename folder
        os.rename(old_path, new_path)

        # Update all scenes that reference this folder
        for root, _, files in os.walk(SCENES_DIR):
            for file in files:
                if file.endswith(".json") and file != "current_scene.json":
                    file_path = os.path.join(root, file)
                    try:
                        with open(file=file_path, mode="r", encoding="utf-8") as buffer:
                            scene_data = json.load(buffer)

                        # Check if this scene's folder needs updating
                        if scene_data.get("folder") == folder_path:
                            scene_data["folder"] = request.new_name
                            with open(file=file_path, mode="w", encoding="utf-8") as buffer:
                                json.dump(scene_data, buffer)
                    except FileNotFoundError as e:
                        logger.exception(f"FileNotFoundError in rename_folder: {e}")
                        # Continue even if one scene fails to update
                        continue
                    except json.JSONDecodeError as e:
                        logger.exception(f"JSONDecodeError in rename_folder: {e}")
                        # Continue even if one scene fails to update
                        continue

        return {"message": "Folder renamed successfully"}
    except HTTPException as e:
        logger.exception(f"HTTPException in rename_folder: {e}")
        raise
    except Exception as e:
        logger.exception(f"Error in rename_folder: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
