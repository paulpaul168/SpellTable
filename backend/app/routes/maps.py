"""
This module contains the maps routes for the FastAPI app.
"""

import json
import os
import shutil
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from loguru import logger

from ..core.constants import MAPS_DIR, SCENES_DIR
from ..models.map import FolderItem, MapData

router = APIRouter()


def ensure_folder_exists(folder_path: str) -> None:
    """Ensure the folder exists, creating it if necessary."""
    os.makedirs(folder_path, exist_ok=True)


def get_folder_structure() -> List[FolderItem]:
    """Scan the maps directory and return the folder structure."""
    folders = []

    for root, _, _ in os.walk(MAPS_DIR):
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
            if file.endswith(
                (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg")
            ):
                rel_path = os.path.relpath(root, MAPS_DIR) if root != MAPS_DIR else ""
                folder = rel_path if rel_path != "" else None

                maps.append({"name": file, "folder": folder})

    return maps


@router.get("/list")
async def list_maps() -> dict[str, list[dict[str, str]]]:
    """List all available maps with their folder structure."""
    maps = get_maps_in_structure()
    return {"maps": maps}


@router.get("/folders")
async def list_folders() -> dict[str, list[FolderItem]]:
    """List all folders in the maps directory."""
    folders = get_folder_structure()
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
        return {"message": f"Folder '{folder_name}' created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/folder/{folder_name}")
async def delete_folder(folder_name: str) -> dict[str, str]:
    """Delete a folder and all its contents."""
    folder_path = os.path.join(MAPS_DIR, folder_name)

    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Folder '{folder_name}' not found")

    try:
        shutil.rmtree(folder_path)
        return {"message": f"Folder '{folder_name}' deleted successfully"}
    except Exception as e:
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
            target_dir = os.path.join(MAPS_DIR, folder)

        ensure_folder_exists(target_dir)

        if file.filename is None:
            raise HTTPException(status_code=400, detail="File name is required")

        # Save the uploaded file
        file_path = os.path.join(target_dir, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        return {
            "filename": file.filename,
            "folder": "" if folder is None else folder,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/file/{path:path}")
async def get_map(path: str) -> FileResponse:
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
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/rename/{file_name}")
async def rename_map(
    file_name: str, rename_data: dict[str, str] = Body(...)
) -> dict[str, str]:
    """Rename a map file and update all scenes that reference it."""
    try:
        new_name = rename_data.get("new_name")

        if not new_name:
            raise HTTPException(status_code=400, detail="New name is required")

        logger.info(f"Attempting to rename map '{file_name}' to '{new_name}'")

        # Find the map in the folder structure
        maps = get_maps_in_structure()
        map_data = next((m for m in maps if m["name"] == file_name), None)

        if not map_data:
            logger.error(f"Map '{file_name}' not found in structure")
            raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

        folder_path = (
            os.path.join(MAPS_DIR, map_data["folder"])
            if map_data["folder"]
            else MAPS_DIR
        )
        old_path = os.path.join(folder_path, file_name)
        new_path = os.path.join(folder_path, new_name)

        # Check if source file exists
        if not os.path.exists(old_path):
            logger.error(f"Source file not found at path: {old_path}")
            raise HTTPException(
                status_code=404, detail=f"Source file '{file_name}' not found"
            )

        # Check if destination file already exists
        if os.path.exists(new_path):
            logger.error(f"Destination file already exists: {new_path}")
            raise HTTPException(
                status_code=409, detail=f"A file named '{new_name}' already exists"
            )

        # First, update all scenes that reference this map
        scenes_updated = 0
        scenes_folder = os.path.join(os.getcwd(), SCENES_DIR)

        logger.debug(
            f"Looking for scenes referencing map '{file_name}' in {scenes_folder}"
        )

        if os.path.exists(scenes_folder):
            for scene_file in os.listdir(scenes_folder):
                if scene_file.endswith(".json"):
                    scene_path = os.path.join(scenes_folder, scene_file)
                    try:
                        with open(file=scene_path, mode="r", encoding="utf-8") as f:
                            scene_data = json.load(f)

                        # Check if this scene references the map
                        map_refs_updated = False

                        # Update map references in the maps array
                        if "maps" in scene_data and isinstance(
                            scene_data["maps"], list
                        ):
                            for i, map_ref in enumerate(scene_data["maps"]):
                                if (
                                    isinstance(map_ref, dict)
                                    and map_ref.get("name") == file_name
                                ):
                                    scene_data["maps"][i]["name"] = new_name
                                    map_refs_updated = True

                        # Update the active map reference if it matches
                        if scene_data.get("activeMapId") == file_name:
                            scene_data["activeMapId"] = new_name
                            map_refs_updated = True

                        # Save the updated scene if changes were made
                        if map_refs_updated:
                            with open(file=scene_path, mode="w", encoding="utf-8") as f:
                                json.dump(scene_data, f, indent=2)
                            scenes_updated += 1
                            logger.info(f"Updated map reference in scene: {scene_file}")
                    except Exception as e:
                        logger.error(f"Error updating scene {scene_file}: {str(e)}")

        # Now rename the actual map file
        logger.info(f"Renaming file from {old_path} to {new_path}")
        try:
            os.rename(old_path, new_path)
        except Exception as e:
            logger.error(f"Error renaming map file: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Error renaming map file: {str(e)}"
            ) from e

        # Also rename any associated JSON data file if it exists
        old_data_path = os.path.join(folder_path, f"{file_name}.json")
        new_data_path = os.path.join(folder_path, f"{new_name}.json")
        if os.path.exists(old_data_path):
            logger.info(f"Renaming data file from {old_data_path} to {new_data_path}")
            try:
                os.rename(old_data_path, new_data_path)
                # Update the name inside the JSON file
                try:
                    with open(file=new_data_path, mode="r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, dict) and "name" in data:
                        data["name"] = new_name
                        with open(file=new_data_path, mode="w", encoding="utf-8") as f:
                            json.dump(data, f, indent=2)
                except Exception as e:
                    logger.error(f"Error updating JSON data file: {str(e)}")
            except Exception as e:
                logger.error(f"Error renaming data file: {str(e)}")
                # Continue even if data file rename fails

        logger.info(f"Successfully renamed map from '{file_name}' to '{new_name}'")
        return {
            "message": f"Map renamed from '{file_name}' to '{new_name}'",
            "scenes_updated": str(scenes_updated),
        }
    except HTTPException:
        # Re-throw HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error renaming map: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/move/{file_name}")
async def move_map(
    file_name: str, move_data: dict[str, str] = Body(...)
) -> dict[str, str]:
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
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/file/{file_name}")
async def delete_map(file_name: str) -> dict[str, str]:
    """Delete a map file."""
    try:
        logger.info(f"Attempting to delete map '{file_name}'")

        # Find the map in the folder structure
        maps = get_maps_in_structure()
        map_data = next((m for m in maps if m["name"] == file_name), None)

        if not map_data:
            logger.error(f"Map '{file_name}' not found in structure")
            raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

        folder_path = (
            os.path.join(MAPS_DIR, map_data["folder"])
            if map_data["folder"]
            else MAPS_DIR
        )
        file_path = os.path.join(folder_path, file_name)

        # Check if the file exists
        if not os.path.exists(file_path):
            logger.error(f"Map file not found at path: {file_path}")
            raise HTTPException(
                status_code=404, detail=f"Map file '{file_name}' not found"
            )

        # Remove the file
        logger.info(f"Deleting map file: {file_path}")
        try:
            os.remove(file_path)
        except Exception as e:
            logger.error(f"Error removing map file: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Error removing map file: {str(e)}"
            ) from e

        # Also delete any associated JSON data file if it exists
        data_path = os.path.join(folder_path, f"{file_name}.json")
        if os.path.exists(data_path):
            logger.info(f"Deleting map data file: {data_path}")
            try:
                os.remove(data_path)
            except Exception as e:
                logger.error(f"Error removing map data file: {str(e)}")
                # Continue even if data file deletion fails

        logger.info(f"Map '{file_name}' deleted successfully")
        return {"message": f"Map '{file_name}' deleted successfully"}
    except HTTPException:
        # Re-throw HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error deleting map: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/data")
async def store_map_data(map_data: MapData) -> dict[str, str]:
    """Store map data including folder information."""
    try:
        # Determine target folder
        target_dir = (
            os.path.join(MAPS_DIR, map_data.folder) if map_data.folder else MAPS_DIR
        )
        ensure_folder_exists(target_dir)

        # Store the map data
        file_path = os.path.join(target_dir, f"{map_data.name}.json")
        with open(file=file_path, mode="w", encoding="utf-8") as f:
            json.dump(map_data.dict(), f)

        return {"message": f"Map '{map_data.name}' stored successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/data/{map_name}")
async def load_map_data(map_name: str) -> dict[str, Any]:
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

        with open(file=file_path, mode="r", encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)

        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
