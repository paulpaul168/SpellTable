"""
Utility functions for map operations.
"""

import json
import os
from pathlib import Path
from typing import Any, Tuple, Union

from fastapi import HTTPException
from loguru import logger

from ..core.constants import MAPS_DIR, SCENES_DIR
from ..models.map import FolderItem


def ensure_folder_exists(folder_path: Union[str, Path]) -> None:
    """Ensure the folder exists, creating it if necessary."""
    os.makedirs(folder_path, exist_ok=True)


def get_folder_structure() -> list[FolderItem]:
    """Scan the maps directory and return the folder structure."""
    folders = []

    for root, _, _ in os.walk(MAPS_DIR):
        rel_path = os.path.relpath(root, MAPS_DIR) if str(root) != str(MAPS_DIR) else ""

        # Skip the root directory itself
        if rel_path != "":
            parent = os.path.dirname(rel_path) if os.path.dirname(rel_path) else None
            folder_name = os.path.basename(rel_path)

            folders.append(FolderItem(name=folder_name, path=rel_path, parent=parent))

    return folders


def get_maps_in_structure() -> list[dict[str, Any]]:
    """Return all maps with their folder structure."""
    maps = []

    for root, _, files in os.walk(MAPS_DIR):
        for file in files:
            if file.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg")):
                rel_path = os.path.relpath(root, MAPS_DIR) if str(root) != str(MAPS_DIR) else ""
                folder = rel_path if rel_path != "" else ""  # Use empty string instead of None

                maps.append({"name": file, "folder": folder})

    return maps


def find_map_in_structure(file_name: str) -> dict[str, Any]:
    """Find a map in the folder structure and return its data."""
    maps = get_maps_in_structure()
    map_data = next((m for m in maps if m["name"] == file_name), None)

    if not map_data:
        logger.error(f"Map '{file_name}' not found in structure")
        raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

    return map_data


def get_map_paths(file_name: str, map_data: dict[str, Any]) -> Tuple[Union[str, Path], str]:
    """Get the folder path and file path for a map."""
    folder_path = os.path.join(MAPS_DIR, map_data["folder"]) if map_data["folder"] else MAPS_DIR
    file_path = os.path.join(folder_path, file_name)

    if not os.path.exists(file_path):
        logger.error(f"Source file not found at path: {file_path}")
        raise HTTPException(status_code=404, detail=f"Source file '{file_name}' not found")

    return folder_path, file_path


def update_scenes_for_renamed_map(file_name: str, new_name: str) -> int:
    """Update all scenes that reference the renamed map and return count of updated scenes."""
    scenes_updated = 0
    scenes_folder = os.path.join(os.getcwd(), SCENES_DIR)

    logger.debug(f"Looking for scenes referencing map '{file_name}' in {scenes_folder}")

    if not os.path.exists(scenes_folder):
        return scenes_updated

    for scene_file in os.listdir(scenes_folder):
        if not scene_file.endswith(".json"):
            continue

        scene_path = os.path.join(scenes_folder, scene_file)
        try:
            with open(file=scene_path, mode="r", encoding="utf-8") as f:
                scene_data = json.load(f)

            map_refs_updated = False

            # Update map references in the maps array
            if "maps" in scene_data and isinstance(scene_data["maps"], list):
                for i, map_ref in enumerate(scene_data["maps"]):
                    if isinstance(map_ref, dict) and map_ref.get("name") == file_name:
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
        except (OSError, json.JSONDecodeError) as e:
            logger.error(f"Error updating scene {scene_file}: {str(e)}")

    return scenes_updated


def rename_map_file(old_path: str, new_path: str) -> None:
    """Rename the map file from old path to new path."""
    try:
        os.rename(old_path, new_path)
    except OSError as e:
        logger.error(f"Error renaming map file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error renaming map file: {str(e)}") from e


def update_map_data_file(old_data_path: str, new_data_path: str, new_name: str) -> None:
    """Rename and update the map's JSON data file if it exists."""
    if not os.path.exists(old_data_path):
        return

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
        except (OSError, json.JSONDecodeError) as e:
            logger.error(f"Error updating JSON data file: {str(e)}")
    except OSError as e:
        logger.error(f"Error renaming data file: {str(e)}")


def delete_map_file(file_path: str) -> None:
    """Delete the map file."""
    try:
        os.remove(file_path)
    except OSError as e:
        logger.error(f"Error removing map file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error removing map file: {str(e)}") from e


def delete_map_data_file(folder_path: Union[str, Path], file_name: str) -> None:
    """Delete the map's JSON data file if it exists."""
    data_path = os.path.join(folder_path, f"{file_name}.json")
    if os.path.exists(data_path):
        logger.info(f"Deleting map data file: {data_path}")
        try:
            os.remove(data_path)
        except OSError as e:
            logger.error(f"Error removing map data file: {str(e)}")
