"""
This module contains the scenes routes for the FastAPI app.
"""

import json
import os
import shutil
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from loguru import logger

from ..core.auth import get_current_active_user, require_admin_role
from ..core.constants import SCENES_DIR
from ..models.scenes import FolderCreateRequest, FolderRenameRequest, SceneData
from ..models.user import User

router = APIRouter()


def _scene_sort_key(scene: dict[str, Any]) -> tuple[int, str]:
    order = scene.get("sortOrder", scene.get("sort_order", 0))
    try:
        order_int = int(order)
    except (TypeError, ValueError):
        order_int = 0
    return (order_int, str(scene.get("name", "")).lower())


def _next_sort_order(folder: str | None) -> int:
    """Return max sortOrder in folder (or root) + 1."""
    max_order = -1
    for root, _, files in os.walk(SCENES_DIR):
        for file in files:
            if not file.endswith(".json") or file == "current_scene.json":
                continue
            file_path = os.path.join(root, file)
            try:
                with open(file=file_path, encoding="utf-8") as f:
                    data = json.load(f)
            except (OSError, json.JSONDecodeError):
                continue
            scene_folder = data.get("folder") or None
            if scene_folder != folder:
                continue
            order = data.get("sortOrder", data.get("sort_order", 0))
            try:
                max_order = max(max_order, int(order))
            except (TypeError, ValueError):
                continue
    return max_order + 1


def _find_scene_file(scene_id: str) -> str | None:
    for root, _, files in os.walk(SCENES_DIR):
        for file in files:
            if file.endswith(".json") and file != "current_scene.json":
                file_path = os.path.join(root, file)
                try:
                    with open(file=file_path, encoding="utf-8") as f:
                        data = json.load(f)
                except (OSError, json.JSONDecodeError):
                    continue
                if data.get("id") == scene_id:
                    return file_path
    return None


@router.post("/save")
async def save_scene(
    scene: SceneData,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """
    Save a new scene (Save As).
    """
    try:
        scene.id = str(uuid.uuid4())
        scene.sort_order = _next_sort_order(scene.folder)

        if scene.folder:
            folder_path = os.path.join(SCENES_DIR, scene.folder)
            os.makedirs(folder_path, exist_ok=True)
            scene_file = os.path.join(folder_path, f"{scene.id}.json")
        else:
            scene_file = os.path.join(SCENES_DIR, f"{scene.id}.json")

        with open(file=scene_file, mode="w", encoding="utf-8") as f:
            json.dump(scene.model_dump(by_alias=True), f)
        return {
            "message": "Scene saved successfully",
            "id": scene.id,
            "name": scene.name,
        }
    except Exception as e:
        logger.exception(f"Error saving scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/list")
async def list_scenes(
    _current_user: User = Depends(require_admin_role),
) -> dict[str, Any]:
    """
    List all scenes.
    """
    try:
        scenes: list[dict[str, Any]] = []
        folders: list[dict[str, Any]] = []

        def scan_directory(path: str, parent_path: str = "") -> None:
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
                    with open(file=item_path, encoding="utf-8") as f:
                        scene_data = json.load(f)
                        scenes.append(scene_data)

        scan_directory(SCENES_DIR)
        scenes.sort(key=_scene_sort_key)
        return {"folders": folders, "scenes": scenes}
    except Exception as e:
        logger.exception(f"Error listing scenes: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/folder")
async def create_folder(
    request: FolderCreateRequest,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """
    Create a folder.
    """
    try:
        if request.parent_folder:
            folder_path = os.path.join(
                SCENES_DIR, request.parent_folder, request.folder_name
            )
        else:
            folder_path = os.path.join(SCENES_DIR, request.folder_name)

        if os.path.exists(folder_path):
            raise HTTPException(status_code=400, detail="Folder already exists")
        os.makedirs(folder_path)
        return {"message": "Folder created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/folder/{folder_path:path}")
async def delete_folder(
    folder_path: str,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """
    Delete a folder.
    """
    try:
        full_path = os.path.join(SCENES_DIR, folder_path)
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Folder not found")
        shutil.rmtree(full_path)
        return {"message": "Folder deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting folder: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/load/{scene_id}")
async def load_scene(
    scene_id: str,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, Any]:
    """
    Load a scene.
    """
    try:
        scene_file = _find_scene_file(scene_id)
        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        with open(file=scene_file, encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)
            return data
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in load_scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{scene_id}")
async def delete_scene(
    scene_id: str,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """
    Delete a scene.
    """
    try:
        scene_file = _find_scene_file(scene_id)
        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        os.remove(scene_file)
        return {"message": "Scene deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in delete_scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/{scene_id}")
async def update_scene(
    scene_id: str,
    scene: SceneData,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """
    Update a scene.
    """
    try:
        scene_file = _find_scene_file(scene_id)
        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        scene.id = scene_id

        # Move file when folder changes (including move to root)
        if scene.folder:
            new_folder_path = os.path.join(SCENES_DIR, scene.folder)
            os.makedirs(new_folder_path, exist_ok=True)
            new_scene_file = os.path.join(new_folder_path, f"{scene_id}.json")
        else:
            new_scene_file = os.path.join(SCENES_DIR, f"{scene_id}.json")

        if scene_file != new_scene_file:
            shutil.move(scene_file, new_scene_file)
            scene_file = new_scene_file

        with open(file=scene_file, mode="w", encoding="utf-8") as f:
            json.dump(scene.model_dump(by_alias=True), f)
        return {"message": "Scene updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in update_scene: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{scene_id}/image")
async def upload_scene_image(
    scene_id: str,
    file: UploadFile = File(...),
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """
    Upload a scene image.
    """
    try:
        scene_file = _find_scene_file(scene_id)
        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        scene_dir = os.path.dirname(scene_file)
        images_dir = os.path.join(scene_dir, "images")
        os.makedirs(images_dir, exist_ok=True)

        image_id = str(uuid.uuid4())
        safe_name = file.filename or "image"
        image_path = os.path.join(images_dir, f"{image_id}_{safe_name}")
        file_content = await file.read()
        with open(image_path, "wb") as buffer:
            buffer.write(file_content)

        relative_path = os.path.relpath(image_path, SCENES_DIR)

        with open(file=scene_file, encoding="utf-8") as buffer:
            scene_data = json.load(buffer)

        if "images" not in scene_data or not isinstance(scene_data["images"], list):
            scene_data["images"] = []

        scene_data["images"].append(
            {
                "id": image_id,
                "name": safe_name,
                "path": relative_path,
            }
        )

        with open(file=scene_file, mode="w", encoding="utf-8") as buffer:
            json.dump(scene_data, buffer)

        return {
            "message": "Image uploaded successfully",
            "image_id": image_id,
            "name": safe_name,
            "path": relative_path,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in upload_scene_image: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/image/{image_path:path}")
async def get_scene_image(
    image_path: str,
    _current_user: User = Depends(get_current_active_user),
) -> FileResponse:
    """
    Get a scene image (any authenticated user).
    """
    try:
        file_path = os.path.join(SCENES_DIR, image_path)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Image not found")
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in get_scene_image: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{scene_id}/image/{image_id}")
async def delete_scene_image(
    scene_id: str,
    image_id: str,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """
    Delete a scene image.
    """
    try:
        scene_file = _find_scene_file(scene_id)
        if not scene_file:
            raise HTTPException(status_code=404, detail="Scene not found")

        with open(file=scene_file, encoding="utf-8") as buffer:
            scene_data = json.load(buffer)

        images = scene_data.get("images") or []
        image_to_delete = next((img for img in images if img.get("id") == image_id), None)
        if not image_to_delete:
            raise HTTPException(status_code=404, detail="Image not found")

        image_path = os.path.join(SCENES_DIR, image_to_delete["path"])
        if os.path.exists(image_path):
            os.remove(image_path)

        scene_data["images"] = [img for img in images if img.get("id") != image_id]
        with open(file=scene_file, mode="w", encoding="utf-8") as buffer:
            json.dump(scene_data, buffer)

        return {"message": "Image deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in delete_scene_image: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/folder/{folder_path:path}")
async def rename_folder(
    folder_path: str,
    request: FolderRenameRequest,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Rename a folder in the scenes directory."""
    try:
        old_path = os.path.join(SCENES_DIR, folder_path)
        if not os.path.exists(old_path):
            raise HTTPException(status_code=404, detail="Folder not found")

        parent_dir = os.path.dirname(old_path)
        new_path = os.path.join(parent_dir, request.new_name)

        if os.path.exists(new_path):
            raise HTTPException(
                status_code=400,
                detail=f"A folder named '{request.new_name}' already exists",
            )

        os.rename(old_path, new_path)

        # Update scenes that reference this folder or nested paths under it
        for root, _, files in os.walk(SCENES_DIR):
            for file in files:
                if file.endswith(".json") and file != "current_scene.json":
                    file_path = os.path.join(root, file)
                    try:
                        with open(file=file_path, encoding="utf-8") as buffer:
                            scene_data = json.load(buffer)

                        current_folder = scene_data.get("folder")
                        if not current_folder:
                            continue

                        if current_folder == folder_path:
                            # Sibling rename: parent/new_name
                            parent = os.path.dirname(folder_path)
                            scene_data["folder"] = (
                                os.path.join(parent, request.new_name)
                                if parent
                                else request.new_name
                            )
                        elif current_folder.startswith(folder_path + os.sep) or current_folder.startswith(
                            folder_path + "/"
                        ):
                            suffix = current_folder[len(folder_path) :]
                            parent = os.path.dirname(folder_path)
                            new_base = (
                                os.path.join(parent, request.new_name)
                                if parent
                                else request.new_name
                            )
                            scene_data["folder"] = new_base + suffix.replace("\\", "/")
                        else:
                            continue

                        scene_data["folder"] = scene_data["folder"].replace("\\", "/")
                        with open(file=file_path, mode="w", encoding="utf-8") as buffer:
                            json.dump(scene_data, buffer)
                    except (FileNotFoundError, json.JSONDecodeError, OSError) as e:
                        logger.exception(f"Error updating scene folder ref: {e}")
                        continue

        return {"message": "Folder renamed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in rename_folder: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
