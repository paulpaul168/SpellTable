"""
This module contains the backup routes for the FastAPI app.
"""

import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Union

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from loguru import logger
from pydantic import BaseModel

from ..core.constants import MAPS_DIR, SCENES_DIR, SOUNDS_DIR

router = APIRouter()


class BackupOptions(BaseModel):
    """Options for backup selection."""

    maps: bool = True
    scenes: bool = True
    audio: bool = True
    include_folders: Optional[List[str]] = None


def remove_file(path: Union[str, Path]) -> None:
    """Remove a file after it has been sent."""
    try:
        os.unlink(path)
    except OSError as e:
        logger.error(f"Error removing temporary file {path}: {e}")


@router.get("/export")
async def export_backup(
    background_tasks: BackgroundTasks,
    maps: bool = Query(True),
    scenes: bool = Query(True),
    audio: bool = Query(True),
    include_folders: Optional[List[str]] = Query(None),
) -> FileResponse:
    """
    Export selected content (maps, scenes, and/or audio) as a zip backup.

    Args:
        background_tasks: Background tasks for cleanup
        maps: Whether to include maps in the backup
        scenes: Whether to include scenes in the backup
        audio: Whether to include audio in the backup
        include_folders: Optional list of folder names to include

    Returns:
        FileResponse with the generated zip file
    """
    # Convert the query parameters to a BackupOptions object
    options = BackupOptions(maps=maps, scenes=scenes, audio=audio, include_folders=include_folders)

    try:
        # Create a temporary file for the zip
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_file:
            zip_path = tmp_file.name

        logger.info(f"Creating backup zip file at {zip_path}")

        # Create the zip file
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            # Add selected content to the zip
            if options.maps:
                logger.info("Adding maps to backup")
                _add_directory_to_zip(zip_file, MAPS_DIR, "maps", options.include_folders)

            if options.scenes:
                logger.info("Adding scenes to backup")
                _add_directory_to_zip(zip_file, SCENES_DIR, "scenes", options.include_folders)

            if options.audio:
                logger.info("Adding audio to backup")
                _add_directory_to_zip(zip_file, SOUNDS_DIR, "sounds", options.include_folders)

        logger.info(
            f"Backup zip file created successfully, size: {os.path.getsize(zip_path)} bytes"
        )

        # Schedule the file to be deleted after it's sent
        background_tasks.add_task(remove_file, zip_path)

        return FileResponse(
            path=zip_path, filename="spelltable_backup.zip", media_type="application/zip"
        )

    except Exception as e:
        # Clean up the temp file if something goes wrong
        if "zip_path" in locals():
            os.unlink(zip_path)
        logger.exception(f"Error creating backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating backup: {str(e)}") from e


def _add_directory_to_zip(
    zip_file: zipfile.ZipFile,
    source_dir: Union[str, Path],
    zip_dir: str,
    include_folders: Optional[List[str]] = None,
) -> None:
    """
    Add contents of a directory to a zip file.

    Args:
        zip_file: The zip file to add to
        source_dir: The source directory to add
        zip_dir: The directory name within the zip
        include_folders: Optional list of folder names to include (if None, include all)
    """
    file_count = 0
    total_size = 0

    for root, _, files in os.walk(source_dir):
        # Skip this folder if it's not in the include list
        if include_folders is not None:
            rel_path = os.path.relpath(root, source_dir)
            folder = rel_path.split(os.path.sep)[0] if rel_path != "." else ""
            if folder and folder not in include_folders:
                continue

        # Add files to the zip
        for file in files:
            file_path = os.path.join(root, file)
            file_size = os.path.getsize(file_path)
            total_size += file_size
            file_count += 1

            # Calculate the relative path for the file in the zip
            rel_path = os.path.relpath(file_path, os.path.dirname(source_dir))
            zip_path = os.path.join(zip_dir, os.path.relpath(file_path, source_dir))
            zip_file.write(file_path, zip_path)

            # Log progress every 10 files
            if file_count % 10 == 0:
                logger.info(f"Added {file_count} files to {zip_dir} ({total_size / 1024:.2f} KB)")

    logger.info(f"Completed adding {file_count} files ({total_size / 1024:.2f} KB) to {zip_dir}")


@router.post("/import")
async def import_backup(
    backup_file: UploadFile = File(...),
    maps: bool = Form(True),
    scenes: bool = Form(True),
    audio: bool = Form(True),
) -> Dict[str, str]:
    """
    Import a backup zip file, extracting the selected content types.

    Args:
        backup_file: The uploaded zip backup file
        maps: Whether to import maps
        scenes: Whether to import scenes
        audio: Whether to import audio

    Returns:
        Dictionary with success message
    """
    # Create options dictionary from form parameters
    options = {"maps": maps, "scenes": scenes, "audio": audio}

    try:
        logger.info(f"Starting import of backup file: {backup_file.filename}")

        # Create a temporary directory to extract the zip
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save the uploaded zip file to the temp directory
            zip_path = os.path.join(temp_dir, "backup.zip")
            logger.info(f"Saving uploaded file to {zip_path}")

            with open(zip_path, "wb") as f:
                content = await backup_file.read()
                f.write(content)

            file_size = os.path.getsize(zip_path)
            logger.info(f"Backup file size: {file_size / 1024:.2f} KB")

            # Extract the zip file
            logger.info("Opening zip file for extraction")
            with zipfile.ZipFile(zip_path, "r") as zip_file:
                # Get the list of files in the zip
                file_list = zip_file.namelist()
                total_files = len(file_list)
                logger.info(f"Found {total_files} files in zip archive")

                # Track statistics
                extracted_files = 0
                processed_files = {"maps": 0, "scenes": 0, "sounds": 0, "other": 0}
                total_size = 0

                # Extract selected content
                for file_path in file_list:
                    parts = file_path.split("/")
                    if not parts:
                        continue

                    # Determine which type of content this is
                    content_type = parts[0]

                    # Skip if this content type is not selected
                    if (
                        (content_type == "maps" and not options.get("maps", True))
                        or (content_type == "scenes" and not options.get("scenes", True))
                        or (content_type == "sounds" and not options.get("audio", True))
                    ):
                        continue

                    # Map the content type to the correct destination directory
                    if content_type == "maps":
                        dest_dir = MAPS_DIR
                        processed_files["maps"] += 1
                    elif content_type == "scenes":
                        dest_dir = SCENES_DIR
                        processed_files["scenes"] += 1
                    elif content_type == "sounds":
                        dest_dir = SOUNDS_DIR
                        processed_files["sounds"] += 1
                    else:
                        # Skip unknown content types
                        processed_files["other"] += 1
                        continue

                    # Extract the file
                    extract_path = os.path.join(temp_dir, file_path)
                    zip_file.extract(file_path, temp_dir)

                    # Count size for logging
                    if os.path.isfile(extract_path):
                        file_size = os.path.getsize(extract_path)
                        total_size += file_size

                    # Determine the destination path
                    rel_path = "/".join(parts[1:])  # Skip the content type part
                    dest_path = os.path.join(dest_dir, rel_path)

                    # Create the destination directory if it doesn't exist
                    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

                    # Copy the extracted file to the destination
                    shutil.copy2(extract_path, dest_path)

                    extracted_files += 1
                    # Log progress every 10 files
                    if extracted_files % 10 == 0:
                        logger.info(
                            f"Imported {extracted_files}/{total_files} files"
                            f"({total_size / 1024:.2f} KB)"
                        )

        # Log final statistics
        logger.info("Import completed successfully:")
        logger.info(f"- Maps: {processed_files['maps']} files")
        logger.info(f"- Scenes: {processed_files['scenes']} files")
        logger.info(f"- Sounds: {processed_files['sounds']} files")
        logger.info(f"- Skipped/Other: {processed_files['other']} files")
        logger.info(f"- Total size: {total_size / 1024:.2f} KB")

        return {"message": "Backup imported successfully"}

    except zipfile.BadZipFile:
        logger.error("Invalid zip file provided for import")
        raise HTTPException(status_code=400, detail="Invalid zip file") from None

    except Exception as e:
        logger.exception(f"Error importing backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing backup: {str(e)}") from e
