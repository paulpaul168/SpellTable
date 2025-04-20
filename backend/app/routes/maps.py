"""
This module contains the maps routes for the FastAPI app.
"""

import json
import os
import shutil
from pathlib import Path
from typing import Any, Optional, Union

from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from loguru import logger

from ..core.constants import MAPS_DIR
from ..models.map import FolderItem, MapData
from ..utils.maps import (
    delete_map_data_file,
    delete_map_file,
    ensure_folder_exists,
    find_map_in_structure,
    get_folder_structure,
    get_map_paths,
    get_maps_in_structure,
    rename_map_file,
    update_map_data_file,
    update_scenes_for_renamed_map,
)

router = APIRouter()


@router.get("/list")
async def list_maps() -> dict[str, list[dict[str, str]]]:
    """list all available maps with their folder structure."""
    maps = get_maps_in_structure()
    logger.trace(f"GET /list: {maps}")
    return {"maps": maps}


@router.get("/folders")
async def list_folders() -> dict[str, list[FolderItem]]:
    """list all folders in the maps directory."""
    folders = get_folder_structure()
    logger.trace(f"GET /folders: {folders}")
    return {"folders": folders}


@router.post("/folder")
async def create_folder(folder_data: dict[str, str] = Body(...)) -> dict[str, str]:
    """Create a new folder in the maps directory."""
    folder_name = folder_data.get("folder_name")
    parent_folder = folder_data.get("parent_folder")

    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required")

    folder_path = (
        os.path.join(MAPS_DIR, parent_folder, folder_name)
        if parent_folder
        else os.path.join(MAPS_DIR, folder_name)
    )

    try:
        os.makedirs(folder_path, exist_ok=True)
        logger.trace(f"POST /folder: Folder '{folder_name}' created successfully")
        return {"message": f"Folder '{folder_name}' created successfully"}
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/folder/{folder_name}")
async def delete_folder(folder_name: str) -> dict[str, str]:
    """Delete a folder and all its contents."""
    folder_path = os.path.join(MAPS_DIR, folder_name)

    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Folder '{folder_name}' not found")

    try:
        shutil.rmtree(folder_path)
        logger.trace(f"DELETE /folder: Folder '{folder_name}' deleted successfully")
        return {"message": f"Folder '{folder_name}' deleted successfully"}
    except (OSError, shutil.Error) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/upload")
async def upload_map(
    file: UploadFile = File(...), folder: Optional[str] = Form(None)
) -> dict[str, str]:
    """Upload a map file, optionally to a specific folder."""
    try:
        # Determine the target directory
        if folder is None:
            target_dir = MAPS_DIR
        else:
            target_dir = Path(os.path.join(MAPS_DIR, folder))

        ensure_folder_exists(target_dir)

        if file.filename is None:
            raise HTTPException(status_code=400, detail="File name is required")

        # Save the uploaded file
        file_path = os.path.join(target_dir, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        logger.trace(f"POST /upload: File '{file.filename}' uploaded successfully to {target_dir}")
        return {
            "filename": file.filename,
            "folder": "" if folder is None else folder,
        }
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/file/{path:path}")
async def get_map(path: str) -> FileResponse:
    """Get a map file by path, supporting folder structure."""
    try:
        # Make sure the path is properly constructed with OS-specific separators
        normalized_path = path.replace("/", os.path.sep).replace("\\", os.path.sep)
        # Strip leading separator if present to avoid treating it as absolute path
        normalized_path = normalized_path.lstrip(os.path.sep)
        file_path = os.path.join(MAPS_DIR, normalized_path)
        logger.trace(f"Attempting to access file at: {file_path}")

        # Log all available maps for debugging
        all_maps = get_maps_in_structure()
        logger.trace(f"All available maps: {[m['name'] for m in all_maps]}")

        # Check if file exists through direct path lookup
        if not os.path.exists(file_path):
            logger.error(f"File not found at path: {file_path}")

            # Try to find the file by name somewhere in the maps directory
            found = False
            for root, _, files in os.walk(MAPS_DIR):
                if path.split("/")[-1] in files:  # Get the filename from the path
                    found = True
                    file_path = os.path.join(root, path.split("/")[-1])
                    logger.debug(f"Found file at alternative location: {file_path}")
                    break

            if not found:
                # Try to debug by listing files in the parent directory
                parent_dir = os.path.dirname(file_path)
                if os.path.exists(parent_dir):
                    logger.debug(f"Contents of parent directory {parent_dir}:")
                    for item in os.listdir(parent_dir):
                        logger.debug(f"  - {item}")
                else:
                    logger.debug(f"Parent directory {parent_dir} does not exist")

                raise HTTPException(status_code=404, detail=f"Map not found: {path}")

        logger.trace(f"GET /file: Returning file {file_path}")
        return FileResponse(file_path)
    except HTTPException as e:
        logger.exception(f"HTTPException in get_map: {e}")
        raise
    except (OSError, IOError) as e:
        logger.exception(f"OSError or IOError in get_map: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/rename/{file_name}")
async def rename_map(
    file_name: str, rename_data: dict[str, str] = Body(...)
) -> dict[str, Union[str, int]]:
    """Rename a map file and update all scenes that reference it."""
    try:
        new_name = rename_data.get("new_name")

        if not new_name:
            raise HTTPException(status_code=400, detail="New name is required")

        logger.info(f"Attempting to rename map '{file_name}' to '{new_name}'")

        # Find the map and get its paths
        map_data = find_map_in_structure(file_name)
        folder_path, old_path = get_map_paths(file_name, map_data)
        new_path = os.path.join(folder_path, new_name)

        # Check if destination file already exists
        if os.path.exists(new_path):
            logger.error(f"Destination file already exists: {new_path}")
            raise HTTPException(status_code=409, detail=f"A file named '{new_name}' already exists")

        # Update scenes that reference this map
        scenes_updated = update_scenes_for_renamed_map(file_name, new_name)

        # Rename the actual map file
        logger.info(f"Renaming file from {old_path} to {new_path}")
        rename_map_file(old_path, new_path)

        # Update associated JSON data file if it exists
        old_data_path = os.path.join(folder_path, f"{file_name}.json")
        new_data_path = os.path.join(folder_path, f"{new_name}.json")
        update_map_data_file(old_data_path, new_data_path, new_name)

        logger.trace(f"Successfully renamed map from '{file_name}' to '{new_name}'")
        return {
            "message": f"Map renamed from '{file_name}' to '{new_name}'",
            "scenes_updated": scenes_updated,
        }
    except HTTPException as e:
        logger.exception(f"HTTPException in rename_map: {e}")
        raise
    except OSError as e:
        logger.exception(f"OSError in rename_map: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/move/{file_name}")
async def move_map(file_name: str, move_data: dict[str, str] = Body(...)) -> dict[str, str]:
    """Move a map file to a different folder."""
    target_folder = move_data.get("folder")

    # Find the map in the folder structure
    maps = get_maps_in_structure()
    map_data = next((m for m in maps if m["name"] == file_name), None)

    if not map_data:
        raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

    # Determine source and target paths
    source_folder = os.path.join(MAPS_DIR, map_data["folder"]) if map_data["folder"] else MAPS_DIR
    target_folder_path = os.path.join(MAPS_DIR, target_folder) if target_folder else MAPS_DIR

    source_path = os.path.join(source_folder, file_name)
    target_path = os.path.join(target_folder_path, file_name)

    try:
        # Ensure target folder exists
        ensure_folder_exists(Path(target_folder_path))

        shutil.move(source_path, target_path)
        logger.trace(f"PUT /move: Map '{file_name}' moved successfully to {target_folder_path}")
        return {"message": f"Map '{file_name}' moved successfully"}
    except (OSError, shutil.Error) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/file/{file_name}")
async def delete_map(file_name: str) -> dict[str, str]:
    """Delete a map file."""
    try:
        logger.info(f"Attempting to delete map '{file_name}'")

        # Find the map and get its paths
        map_data = find_map_in_structure(file_name)
        folder_path, file_path = get_map_paths(file_name, map_data)

        # Delete the map file
        logger.info(f"Deleting map file: {file_path}")
        delete_map_file(file_path)

        # Delete any associated JSON data file
        delete_map_data_file(folder_path, file_name)

        logger.trace(f"Map '{file_name}' deleted successfully")
        return {"message": f"Map '{file_name}' deleted successfully"}
    except HTTPException as e:
        logger.exception(f"HTTPException in delete_map: {e}")
        raise
    except OSError as e:
        logger.exception(f"OSError in delete_map: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/data")
async def store_map_data(map_data: MapData) -> dict[str, str]:
    """Store map data including folder information."""
    try:
        # Determine target folder
        target_dir = Path(os.path.join(MAPS_DIR, map_data.folder)) if map_data.folder else MAPS_DIR
        ensure_folder_exists(target_dir)

        file_path = os.path.join(target_dir, f"{map_data.name}.json")
        with open(file=file_path, mode="w", encoding="utf-8") as f:
            json.dump(map_data.model_dump(), f)

        logger.trace(f"POST /data: Map '{map_data.name}' stored successfully")
        return {"message": f"Map '{map_data.name}' stored successfully"}
    except (OSError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/data/{map_name}")
async def load_map_data(map_name: str) -> dict[str, Any]:
    """Load map data for a specified map."""
    try:
        # Find the map in the folder structure
        map_data = find_map_in_structure(map_name)

        file_path = (
            os.path.join(MAPS_DIR, map_data["folder"], f"{map_name}.json")
            if map_data["folder"]
            else os.path.join(MAPS_DIR, f"{map_name}.json")
        )

        if not os.path.exists(file_path):
            # If JSON data doesn't exist, return basic map data
            return {
                "name": map_name,
                "folder": map_data["folder"],
                "data": {
                    "position": {"x": 0, "y": 0},
                    "scale": 1,
                    "rotation": 0,
                    "isHidden": True,
                },
            }

        with open(file=file_path, mode="r", encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)

        logger.trace(f"GET /data: Loaded map data for '{map_name}'")
        return data
    except HTTPException as e:
        logger.exception(f"HTTPException in load_map_data: {e}")
        raise
    except (OSError, json.JSONDecodeError) as e:
        logger.exception(f"OSError or JSONDecodeError in load_map_data: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
