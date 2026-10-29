"""
This module contains the maps routes for the FastAPI app.
"""

import json
import os
import shutil
from typing import Any

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from loguru import logger

from ..core.auth import require_admin_role
from ..core.constants import MAPS_DIR, SCENES_DIR
from ..models.map import FolderItem, FolderRenameRequest, MapData, MapOrderRequest
from ..models.user import User

router = APIRouter()

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg")
ORDER_FILENAME = ".order.json"


def ensure_folder_exists(folder_path: str) -> None:
    """Ensure the folder exists, creating it if necessary."""
    os.makedirs(folder_path, exist_ok=True)


def _dir_for_folder(folder: str | None) -> str:
    if folder:
        return os.path.join(MAPS_DIR, folder.replace("\\", "/"))
    return MAPS_DIR


def _order_file_path(folder: str | None) -> str:
    return os.path.join(_dir_for_folder(folder), ORDER_FILENAME)


def _read_order(folder: str | None) -> list[str]:
    path = _order_file_path(folder)
    if not os.path.exists(path):
        return []
    try:
        with open(file=path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [str(x) for x in data]
        if isinstance(data, dict) and isinstance(data.get("filenames"), list):
            return [str(x) for x in data["filenames"]]
    except (OSError, json.JSONDecodeError) as e:
        logger.warning(f"Failed to read map order file {path}: {e}")
    return []


def _write_order(folder: str | None, filenames: list[str]) -> None:
    target_dir = _dir_for_folder(folder)
    ensure_folder_exists(target_dir)
    path = _order_file_path(folder)
    with open(file=path, mode="w", encoding="utf-8") as f:
        json.dump(filenames, f, indent=2)


def _sort_maps(maps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort maps by per-folder .order.json, then by name."""
    by_folder: dict[str | None, list[dict[str, Any]]] = {}
    for m in maps:
        key = m.get("folder") or None
        by_folder.setdefault(key, []).append(m)

    sorted_maps: list[dict[str, Any]] = []
    for folder, group in by_folder.items():
        order = _read_order(folder)
        index = {name: i for i, name in enumerate(order)}

        def sort_key(
            item: dict[str, Any],
            _index: dict[str, int] = index,
            _order: list[str] = order,
        ) -> tuple[int, str]:
            name = item["name"]
            return (_index.get(name, len(_order)), name.lower())

        group.sort(key=sort_key)
        sorted_maps.extend(group)
    return sorted_maps


def get_folder_structure() -> list[FolderItem]:
    """Scan the maps directory and return the folder structure."""
    folders: list[FolderItem] = []

    for root, _, _ in os.walk(MAPS_DIR):
        rel_path = os.path.relpath(root, MAPS_DIR) if root != MAPS_DIR else ""
        if rel_path == "" or rel_path == ".":
            continue
        rel_path = rel_path.replace("\\", "/")
        parent_raw = os.path.dirname(rel_path)
        parent = parent_raw.replace("\\", "/") if parent_raw else None
        folder_name = os.path.basename(rel_path)
        folders.append(FolderItem(name=folder_name, path=rel_path, parent=parent))

    return folders


def get_maps_in_structure() -> list[dict[str, Any]]:
    """Return all maps with their folder structure."""
    maps: list[dict[str, Any]] = []

    for root, _, files in os.walk(MAPS_DIR):
        for file in files:
            if file == ORDER_FILENAME:
                continue
            if file.lower().endswith(IMAGE_EXTENSIONS):
                rel_path = os.path.relpath(root, MAPS_DIR) if root != MAPS_DIR else ""
                folder = None if rel_path in ("", ".") else rel_path.replace("\\", "/")
                maps.append({"name": file, "folder": folder})

    return _sort_maps(maps)


def _walk_scene_json_files() -> list[str]:
    paths: list[str] = []
    if not os.path.exists(SCENES_DIR):
        return paths
    for root, _, files in os.walk(SCENES_DIR):
        for file in files:
            if file.endswith(".json") and file != "current_scene.json":
                paths.append(os.path.join(root, file))
    return paths


def _update_scene_map_folders(
    old_folder: str, new_folder: str | None, map_name: str | None = None
) -> int:
    """Update folder field on scene map refs. If map_name is set, only that name."""
    updated = 0
    for scene_path in _walk_scene_json_files():
        try:
            with open(file=scene_path, encoding="utf-8") as f:
                scene_data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue

        changed = False
        maps = scene_data.get("maps")
        if isinstance(maps, list):
            for map_ref in maps:
                if not isinstance(map_ref, dict):
                    continue
                if map_name and map_ref.get("name") != map_name:
                    continue
                current = map_ref.get("folder") or None
                if current == old_folder:
                    if new_folder:
                        map_ref["folder"] = new_folder
                    else:
                        map_ref.pop("folder", None)
                    changed = True
                elif current and (
                    current.startswith(old_folder + "/")
                    or current.startswith(old_folder + os.sep)
                ):
                    suffix = current[len(old_folder) :]
                    map_ref["folder"] = (
                        ((new_folder or "") + suffix).replace("\\", "/").lstrip("/")
                    )
                    if not map_ref["folder"]:
                        map_ref.pop("folder", None)
                    changed = True

        if changed:
            with open(file=scene_path, mode="w", encoding="utf-8") as f:
                json.dump(scene_data, f, indent=2)
            updated += 1
    return updated


@router.get("/list")
async def list_maps(
    _current_user: User = Depends(require_admin_role),
) -> dict[str, list[dict[str, str]]]:
    """List all available maps with their folder structure."""
    maps = get_maps_in_structure()
    return {"maps": maps}


@router.get("/folders")
async def list_folders(
    _current_user: User = Depends(require_admin_role),
) -> dict[str, list[FolderItem]]:
    """List all folders in the maps directory."""
    folders = get_folder_structure()
    return {"folders": folders}


@router.put("/order")
async def set_map_order(
    request: MapOrderRequest,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Persist display order of maps within a folder (or root)."""
    folder = request.folder or None
    target = _dir_for_folder(folder)
    if not os.path.isdir(target):
        raise HTTPException(status_code=404, detail="Folder not found")
    _write_order(folder, request.filenames)
    return {"message": "Map order saved"}


@router.post("/folder")
async def create_folder(
    folder_data: dict[str, str] = Body(...),
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
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
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/folder/{folder_path:path}")
async def delete_folder(
    folder_path: str,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Delete a folder and all its contents (full relative path)."""
    full_path = os.path.join(MAPS_DIR, folder_path)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"Folder '{folder_path}' not found")

    try:
        shutil.rmtree(full_path)
        return {"message": f"Folder '{folder_path}' deleted successfully"}
    except (OSError, shutil.Error) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/folder/{folder_path:path}")
async def rename_folder(
    folder_path: str,
    request: FolderRenameRequest,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Rename a folder and update sidecar/scene folder references."""
    old_path = os.path.join(MAPS_DIR, folder_path)
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

    parent = os.path.dirname(folder_path).replace("\\", "/")
    new_folder = (
        f"{parent}/{request.new_name}" if parent and parent != "." else request.new_name
    )
    new_folder = new_folder.replace("\\", "/")

    # Update sidecars under the renamed tree
    for root, _, files in os.walk(new_path):
        for file in files:
            if not file.endswith(".json") or file == ORDER_FILENAME:
                continue
            if file.lower().endswith(IMAGE_EXTENSIONS):
                continue
            # sidecar is {image}.json — skip if not paired; still try update folder field
            file_path = os.path.join(root, file)
            try:
                with open(file=file_path, encoding="utf-8") as f:
                    data = json.load(f)
                if not isinstance(data, dict):
                    continue
                current = data.get("folder")
                if current == folder_path:
                    data["folder"] = new_folder
                elif isinstance(current, str) and (
                    current.startswith(folder_path + "/")
                    or current.startswith(folder_path + os.sep)
                ):
                    data["folder"] = (new_folder + current[len(folder_path) :]).replace(
                        "\\", "/"
                    )
                else:
                    continue
                with open(file=file_path, mode="w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
            except (OSError, json.JSONDecodeError):
                continue

    _update_scene_map_folders(folder_path, new_folder)
    return {"message": "Folder renamed successfully"}


@router.post("/upload")
async def upload_map(
    file: UploadFile = File(...),
    folder: str | None = Form(None),
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Upload a map file, optionally to a specific folder."""
    try:
        target_dir = _dir_for_folder(folder)
        ensure_folder_exists(target_dir)

        if file.filename is None:
            raise HTTPException(status_code=400, detail="File name is required")

        file_path = os.path.join(target_dir, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Append to order file so new uploads appear at end
        order = _read_order(folder or None)
        if file.filename not in order:
            order.append(file.filename)
            _write_order(folder or None, order)

        return {
            "filename": file.filename,
            "folder": "" if folder is None else folder,
        }
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/file/{path:path}")
async def get_map(path: str) -> FileResponse:
    """Get a map file by path (open — viewers need this for the board)."""
    try:
        normalized_path = path.replace("/", os.path.sep).replace("\\", os.path.sep)
        normalized_path = normalized_path.lstrip(os.path.sep)
        file_path = os.path.join(MAPS_DIR, normalized_path)

        if not os.path.exists(file_path):
            filename = path.split("/")[-1]
            found = False
            for root, _, files in os.walk(MAPS_DIR):
                if filename in files:
                    found = True
                    file_path = os.path.join(root, filename)
                    break
            if not found:
                raise HTTPException(status_code=404, detail=f"Map not found: {path}")

        return FileResponse(file_path)
    except HTTPException:
        raise
    except OSError as e:
        logger.exception(f"OSError in get_map: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


def find_map_in_structure(file_name: str) -> dict[str, Any]:
    """Find a map in the folder structure and return its data."""
    maps = get_maps_in_structure()
    map_data = next((m for m in maps if m["name"] == file_name), None)

    if not map_data:
        raise HTTPException(status_code=404, detail=f"Map '{file_name}' not found")

    return map_data


def get_map_paths(file_name: str, map_data: dict[str, Any]) -> tuple[str, str]:
    """Get the folder path and file path for a map."""
    folder_path = (
        os.path.join(MAPS_DIR, map_data["folder"]) if map_data["folder"] else MAPS_DIR
    )
    file_path = os.path.join(folder_path, file_name)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404, detail=f"Source file '{file_name}' not found"
        )

    return folder_path, file_path


def update_scenes_for_renamed_map(file_name: str, new_name: str) -> int:
    """Update all scenes that reference the renamed map and return count of updated scenes."""
    scenes_updated = 0

    for scene_path in _walk_scene_json_files():
        try:
            with open(file=scene_path, encoding="utf-8") as f:
                scene_data = json.load(f)

            map_refs_updated = False

            if "maps" in scene_data and isinstance(scene_data["maps"], list):
                for i, map_ref in enumerate(scene_data["maps"]):
                    if isinstance(map_ref, dict) and map_ref.get("name") == file_name:
                        scene_data["maps"][i]["name"] = new_name
                        map_refs_updated = True

            if scene_data.get("activeMapId") == file_name:
                scene_data["activeMapId"] = new_name
                map_refs_updated = True

            if map_refs_updated:
                with open(file=scene_path, mode="w", encoding="utf-8") as f:
                    json.dump(scene_data, f, indent=2)
                scenes_updated += 1
        except (OSError, json.JSONDecodeError) as e:
            logger.error(f"Error updating scene {scene_path}: {str(e)}")

    return scenes_updated


def rename_map_file(old_path: str, new_path: str) -> None:
    """Rename the map file from old path to new path."""
    try:
        os.rename(old_path, new_path)
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Error renaming map file: {str(e)}"
        ) from e


def update_map_data_file(old_data_path: str, new_data_path: str, new_name: str) -> None:
    """Rename and update the map's JSON data file if it exists."""
    if not os.path.exists(old_data_path):
        return

    try:
        os.rename(old_data_path, new_data_path)
        try:
            with open(file=new_data_path, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and "name" in data:
                data["name"] = new_name
                with open(file=new_data_path, mode="w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
        except (OSError, json.JSONDecodeError) as e:
            logger.error(f"Error updating JSON data file: {str(e)}")
    except OSError as e:
        logger.error(f"Error renaming data file: {str(e)}")


@router.put("/rename/{file_name}")
async def rename_map(
    file_name: str,
    rename_data: dict[str, str] = Body(...),
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str | int]:
    """Rename a map file and update all scenes that reference it."""
    try:
        new_name = rename_data.get("new_name")
        if not new_name:
            raise HTTPException(status_code=400, detail="New name is required")

        map_data = find_map_in_structure(file_name)
        folder_path, old_path = get_map_paths(file_name, map_data)
        new_path = os.path.join(folder_path, new_name)

        if os.path.exists(new_path):
            raise HTTPException(
                status_code=409, detail=f"A file named '{new_name}' already exists"
            )

        scenes_updated = update_scenes_for_renamed_map(file_name, new_name)
        rename_map_file(old_path, new_path)

        old_data_path = os.path.join(folder_path, f"{file_name}.json")
        new_data_path = os.path.join(folder_path, f"{new_name}.json")
        update_map_data_file(old_data_path, new_data_path, new_name)

        # Update order file
        folder = map_data.get("folder") or None
        order = _read_order(folder)
        order = [new_name if n == file_name else n for n in order]
        if new_name not in order:
            order.append(new_name)
        _write_order(folder, order)

        return {
            "message": f"Map renamed from '{file_name}' to '{new_name}'",
            "scenes_updated": scenes_updated,
        }
    except HTTPException:
        raise
    except (OSError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/move/{file_name}")
async def move_map(
    file_name: str,
    move_data: dict[str, str] = Body(...),
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Move a map file (and sidecar) to a different folder."""
    target_folder = move_data.get("folder") or None

    map_data = find_map_in_structure(file_name)
    source_folder_key = map_data.get("folder") or None
    source_folder = _dir_for_folder(source_folder_key)
    target_folder_path = _dir_for_folder(target_folder)

    source_path = os.path.join(source_folder, file_name)
    target_path = os.path.join(target_folder_path, file_name)

    try:
        ensure_folder_exists(target_folder_path)
        shutil.move(source_path, target_path)

        # Move sidecar JSON if present
        old_sidecar = os.path.join(source_folder, f"{file_name}.json")
        new_sidecar = os.path.join(target_folder_path, f"{file_name}.json")
        if os.path.exists(old_sidecar):
            shutil.move(old_sidecar, new_sidecar)
            try:
                with open(file=new_sidecar, encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    if target_folder:
                        data["folder"] = target_folder
                    else:
                        data.pop("folder", None)
                    with open(file=new_sidecar, mode="w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
            except (OSError, json.JSONDecodeError):
                pass

        # Update order files
        source_order = [n for n in _read_order(source_folder_key) if n != file_name]
        _write_order(source_folder_key, source_order)
        target_order = _read_order(target_folder)
        if file_name not in target_order:
            target_order.append(file_name)
        _write_order(target_folder, target_order)

        _update_scene_map_folders(
            source_folder_key or "", target_folder, map_name=file_name
        )
        # Also set folder on scene refs that only matched by name when source was root
        if not source_folder_key:
            for scene_path in _walk_scene_json_files():
                try:
                    with open(file=scene_path, encoding="utf-8") as f:
                        scene_data = json.load(f)
                    changed = False
                    for map_ref in scene_data.get("maps") or []:
                        if (
                            isinstance(map_ref, dict)
                            and map_ref.get("name") == file_name
                            and not map_ref.get("folder")
                        ):
                            if target_folder:
                                map_ref["folder"] = target_folder
                            changed = True
                    if changed:
                        with open(file=scene_path, mode="w", encoding="utf-8") as f:
                            json.dump(scene_data, f, indent=2)
                except (OSError, json.JSONDecodeError):
                    continue

        return {"message": f"Map '{file_name}' moved successfully"}
    except (OSError, shutil.Error) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def delete_map_file(file_path: str) -> None:
    """Delete the map file."""
    try:
        os.remove(file_path)
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Error removing map file: {str(e)}"
        ) from e


def delete_map_data_file(folder_path: str, file_name: str) -> None:
    """Delete the map's JSON data file if it exists."""
    data_path = os.path.join(folder_path, f"{file_name}.json")
    if os.path.exists(data_path):
        try:
            os.remove(data_path)
        except OSError as e:
            logger.error(f"Error removing map data file: {str(e)}")


@router.delete("/file/{file_name}")
async def delete_map(
    file_name: str,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Delete a map file."""
    try:
        map_data = find_map_in_structure(file_name)
        folder_path, file_path = get_map_paths(file_name, map_data)
        delete_map_file(file_path)
        delete_map_data_file(folder_path, file_name)

        folder = map_data.get("folder") or None
        order = [n for n in _read_order(folder) if n != file_name]
        _write_order(folder, order)

        return {"message": f"Map '{file_name}' deleted successfully"}
    except HTTPException:
        raise
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/data")
async def store_map_data(
    map_data: MapData,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, str]:
    """Store map data including folder information."""
    try:
        target_dir = (
            os.path.join(MAPS_DIR, map_data.folder) if map_data.folder else MAPS_DIR
        )
        ensure_folder_exists(target_dir)

        file_path = os.path.join(target_dir, f"{map_data.name}.json")
        with open(file=file_path, mode="w", encoding="utf-8") as f:
            json.dump(map_data.model_dump(), f)

        return {"message": f"Map '{map_data.name}' stored successfully"}
    except (OSError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/data/{map_name}")
async def load_map_data(
    map_name: str,
    _current_user: User = Depends(require_admin_role),
) -> dict[str, Any]:
    """Load map data for a specified map."""
    try:
        map_data = find_map_in_structure(map_name)

        file_path = (
            os.path.join(MAPS_DIR, map_data["folder"], f"{map_name}.json")
            if map_data["folder"]
            else os.path.join(MAPS_DIR, f"{map_name}.json")
        )

        if not os.path.exists(file_path):
            return {
                "name": map_name,
                "folder": map_data["folder"],
                "data": {
                    "position": {"x": 9, "y": 16},
                    "useGridCoordinates": True,
                    "useGridScaling": True,
                    "scale": 1,
                    "rotation": 0,
                    "isHidden": True,
                },
            }

        with open(file=file_path, encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)

        return data
    except HTTPException:
        raise
    except (OSError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
