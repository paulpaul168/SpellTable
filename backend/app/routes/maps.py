from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import JSONResponse, FileResponse
from ..models.map import MapData, FolderItem
from ..core.constants import MAPS_DIR
import json
import os
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from loguru import logger

router = APIRouter()


def ensure_folder_exists(folder_path: str) -> None:
    """Ensure the folder exists, creating it if necessary."""
    os.makedirs(folder_path, exist_ok=True)


def get_folder_structure() -> List[FolderItem]:
    """Scan the maps directory and return the folder structure."""
    folders = []

    for root, dirs, _ in os.walk(MAPS_DIR):
        rel_path = os.path.relpath(root, MAPS_DIR) if root != MAPS_DIR else ""

        # Skip the root directory itself
        if rel_path != "":
            parent = os.path.dirname(rel_path) if os.path.dirname(rel_path) else None
            folder_name = os.path.basename(rel_path)

            folders.append(FolderItem(name=folder_name, path=rel_path, parent=parent))

    return folders


def get_maps_in_structure() -> List[Dict[str, Any]]:
    """Return all maps with their folder structure."""
    maps = []

    for root, _, files in os.walk(MAPS_DIR):
        for file in files:
            if file.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
                rel_path = os.path.relpath(root, MAPS_DIR) if root != MAPS_DIR else ""
                folder = rel_path if rel_path != "" else None

                maps.append({"name": file, "folder": folder})

    return maps


@router.get("/list")
async def list_maps():
    """List all available maps with their folder structure."""
    maps = get_maps_in_structure()
    return {"maps": maps}


@router.get("/folders")
async def list_folders():
    """List all folders in the maps directory."""
    folders = get_folder_structure()
    return {"folders": folders}


@router.post("/folder")
async def create_folder(folder_data: dict = Body(...)):
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
        return {"message": f"Folder '{folder_name}' created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/folder/{folder_name}")
async def delete_folder(folder_name: str):
    """Delete a folder and all its contents."""
    folder_path = os.path.join(MAPS_DIR, folder_name)

    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Folder '{folder_name}' not found")

    try:
        shutil.rmtree(folder_path)
        return {"message": f"Folder '{folder_name}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_map(file: UploadFile = File(...), folder: Optional[str] = Form(None)):
    """Upload a map file, optionally to a specific folder."""
    try:
        # Determine the target directory
        target_dir = os.path.join(MAPS_DIR, folder) if folder else MAPS_DIR
        ensure_folder_exists(target_dir)

        # Save the uploaded file
        file_path = os.path.join(target_dir, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        return {"filename": file.filename, "folder": folder}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{path:path}")
async def get_map(path: str):
    """Get a map file by path, supporting folder structure."""
    try:
        # Make sure the path is properly constructed with OS-specific separators
        normalized_path = path.replace("/", os.path.sep).replace("\\", os.path.sep)
        file_path = os.path.join(MAPS_DIR, normalized_path)
        logger.debug(f"Attempting to access file at: {file_path}")

        # Log all available maps for debugging
        all_maps = get_maps_in_structure()
        logger.debug(f"All available maps: {[m['name'] for m in all_maps]}")

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

        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accessing file {path}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/rename/{file_name}")
async def rename_map(file_name: str, rename_data: dict = Body(...)):
    """Rename a map file."""
    new_name = rename_data.get("new_name")

    if not new_name:
        raise HTTPException(status_code=400, detail="New name is required")

    # Find the map in the folder structure
    maps = get_maps_in_structure()
    map_data = next((m for m in maps if m["name"] == file_name), None)

    if not map_data:
        raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

    folder_path = (
        os.path.join(MAPS_DIR, map_data["folder"]) if map_data["folder"] else MAPS_DIR
    )
    old_path = os.path.join(folder_path, file_name)
    new_path = os.path.join(folder_path, new_name)

    try:
        # Rename the file
        os.rename(old_path, new_path)
        return {"message": f"Map renamed from '{file_name}' to '{new_name}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/move/{file_name}")
async def move_map(file_name: str, move_data: dict = Body(...)):
    """Move a map file to a different folder."""
    target_folder = move_data.get("folder")

    # Find the map in the folder structure
    maps = get_maps_in_structure()
    map_data = next((m for m in maps if m["name"] == file_name), None)

    if not map_data:
        raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

    # Determine source and target paths
    source_folder = (
        os.path.join(MAPS_DIR, map_data["folder"]) if map_data["folder"] else MAPS_DIR
    )
    target_folder_path = (
        os.path.join(MAPS_DIR, target_folder) if target_folder else MAPS_DIR
    )

    source_path = os.path.join(source_folder, file_name)
    target_path = os.path.join(target_folder_path, file_name)

    try:
        # Ensure target folder exists
        ensure_folder_exists(target_folder_path)

        # Move the file
        shutil.move(source_path, target_path)
        return {"message": f"Map '{file_name}' moved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/file/{file_name}")
async def delete_map(file_name: str):
    """Delete a map file."""
    # Find the map in the folder structure
    maps = get_maps_in_structure()
    map_data = next((m for m in maps if m["name"] == file_name), None)

    if not map_data:
        raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

    file_path = (
        os.path.join(MAPS_DIR, map_data["folder"], file_name)
        if map_data["folder"]
        else os.path.join(MAPS_DIR, file_name)
    )

    try:
        # Remove the file
        os.remove(file_path)
        return {"message": f"Map '{file_name}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data")
async def store_map_data(map_data: MapData):
    """Store map data including folder information."""
    try:
        # Determine target folder
        target_dir = (
            os.path.join(MAPS_DIR, map_data.folder) if map_data.folder else MAPS_DIR
        )
        ensure_folder_exists(target_dir)

        # Store the map data
        file_path = os.path.join(target_dir, f"{map_data.name}.json")
        with open(file_path, "w") as f:
            json.dump(map_data.dict(), f)

        return {"message": f"Map '{map_data.name}' stored successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/{map_name}")
async def load_map_data(map_name: str):
    """Load map data for a specified map."""
    try:
        # Find the map in the folder structure
        maps = get_maps_in_structure()
        map_data = next((m for m in maps if m["name"] == map_name), None)

        if not map_data:
            raise HTTPException(status_code=404, detail=f"Map '{map_name}' not found")

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

        with open(file_path, "r") as f:
            data = json.load(f)

        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
