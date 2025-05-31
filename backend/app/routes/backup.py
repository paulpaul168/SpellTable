"""
This module contains the backup routes for the FastAPI app.
"""

import os
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

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


class ImportStats(BaseModel):
    """Statistics for import operations."""

    extracted_files: int = 0
    processed_files: Dict[str, int] = {"maps": 0, "scenes": 0, "sounds": 0, "other": 0}
    total_size: int = 0


@dataclass
class ProcessingContext:
    """Context object for file processing operations."""

    zip_file: zipfile.ZipFile
    temp_dir: str
    options: Dict[str, bool]
    stats: ImportStats
    total_files: int


@dataclass
class ExtractionContext:
    """Context object for file extraction operations."""

    zip_file: zipfile.ZipFile
    temp_dir: str
    dest_dir: str
    stats: ImportStats


def remove_file(path: str) -> None:
    """Remove a file after it has been sent."""
    try:
        os.unlink(path)
    except (FileNotFoundError, PermissionError, OSError) as e:
        logger.error(f"Error removing temporary file {path}: {e}")


def _should_skip_content_type(content_type: str, options: Dict[str, bool]) -> bool:
    """Check if a content type should be skipped based on options."""
    skip_maps = content_type == "maps" and not options.get("maps", True)
    skip_scenes = content_type == "scenes" and not options.get("scenes", True)
    skip_audio = content_type == "sounds" and not options.get("audio", True)

    return skip_maps or skip_scenes or skip_audio


def _get_destination_directory(content_type: str) -> Optional[str]:
    """Get the destination directory for a given content type."""
    content_map = {
        "maps": str(MAPS_DIR),
        "scenes": str(SCENES_DIR),
        "sounds": str(SOUNDS_DIR),
    }
    return content_map.get(content_type)


def _process_zip_file(
    zip_file: zipfile.ZipFile,
    temp_dir: str,
    options: Dict[str, bool],
    stats: ImportStats,
) -> None:
    """Process all files in the zip archive."""
    file_list = zip_file.namelist()
    total_files = len(file_list)
    logger.info(f"Found {total_files} files in zip archive")

    context = ProcessingContext(
        zip_file=zip_file, temp_dir=temp_dir, options=options, stats=stats, total_files=total_files
    )

    for file_path in file_list:
        _process_single_file(context, file_path)


def _process_single_file(context: ProcessingContext, file_path: str) -> None:
    """Process a single file from the zip archive."""
    parts = file_path.split("/")
    if not parts:
        return

    content_type = parts[0]

    # Skip if this content type is not selected
    if _should_skip_content_type(content_type, context.options):
        return

    # Get destination directory
    dest_dir = _get_destination_directory(content_type)
    if not dest_dir:
        context.stats.processed_files["other"] += 1
        return

    # Update stats
    if content_type in context.stats.processed_files:
        context.stats.processed_files[content_type] += 1

    # Create extraction context
    extraction_context = ExtractionContext(
        zip_file=context.zip_file, temp_dir=context.temp_dir, dest_dir=dest_dir, stats=context.stats
    )

    # Extract and copy the file
    _extract_and_copy_file(extraction_context, file_path, parts)

    # Log progress
    if context.stats.extracted_files % 10 == 0:
        logger.info(
            f"Imported {context.stats.extracted_files}/{context.total_files} files "
            f"({context.stats.total_size / 1024:.2f} KB)"
        )


def _extract_and_copy_file(context: ExtractionContext, file_path: str, parts: List[str]) -> None:
    """Extract a file from zip and copy it to destination."""
    # Extract the file
    extract_path = os.path.join(context.temp_dir, file_path)
    context.zip_file.extract(file_path, context.temp_dir)

    # Count size for logging
    if os.path.isfile(extract_path):
        file_size = os.path.getsize(extract_path)
        context.stats.total_size += file_size

    # Determine the destination path
    rel_path = "/".join(parts[1:])  # Skip the content type part
    dest_path = os.path.join(context.dest_dir, rel_path)

    # Create the destination directory if it doesn't exist
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

    # Copy the extracted file to the destination
    shutil.copy2(extract_path, dest_path)
    context.stats.extracted_files += 1


def _save_uploaded_file(backup_file: UploadFile, temp_dir: str) -> Tuple[str, int]:
    """Save the uploaded file to temp directory and return path and size."""
    zip_path = os.path.join(temp_dir, "backup.zip")
    logger.info(f"Saving uploaded file to {zip_path}")

    with open(zip_path, "wb") as f:
        content = backup_file.file.read()
        f.write(content)

    file_size = os.path.getsize(zip_path)
    logger.info(f"Backup file size: {file_size / 1024:.2f} KB")
    return zip_path, file_size


async def _save_uploaded_file_async(backup_file: UploadFile, temp_dir: str) -> Tuple[str, int]:
    """Save the uploaded file to temp directory and return path and size."""
    zip_path = os.path.join(temp_dir, "backup.zip")
    logger.info(f"Saving uploaded file to {zip_path}")

    content = await backup_file.read()
    with open(zip_path, "wb") as f:
        f.write(content)

    file_size = os.path.getsize(zip_path)
    logger.info(f"Backup file size: {file_size / 1024:.2f} KB")
    return zip_path, file_size


def _log_import_statistics(stats: ImportStats) -> None:
    """Log the final import statistics."""
    logger.info("Import completed successfully:")
    logger.info(f"- Maps: {stats.processed_files['maps']} files")
    logger.info(f"- Scenes: {stats.processed_files['scenes']} files")
    logger.info(f"- Sounds: {stats.processed_files['sounds']} files")
    logger.info(f"- Skipped/Other: {stats.processed_files['other']} files")
    logger.info(f"- Total size: {stats.total_size / 1024:.2f} KB")


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
                _add_directory_to_zip(zip_file, str(MAPS_DIR), "maps", options.include_folders)

            if options.scenes:
                logger.info("Adding scenes to backup")
                _add_directory_to_zip(zip_file, str(SCENES_DIR), "scenes", options.include_folders)

            if options.audio:
                logger.info("Adding audio to backup")
                _add_directory_to_zip(zip_file, str(SOUNDS_DIR), "sounds", options.include_folders)

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
    source_dir: str,
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
            folder = rel_path.split(os.path.sep, maxsplit=1)[0] if rel_path != "." else ""
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
    options = {"maps": maps, "scenes": scenes, "audio": audio}
    stats = ImportStats()

    try:
        logger.info(f"Starting import of backup file: {backup_file.filename}")

        # Create a temporary directory to extract the zip
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save the uploaded zip file to the temp directory
            zip_path, _ = await _save_uploaded_file_async(backup_file, temp_dir)

            # Extract the zip file
            logger.info("Opening zip file for extraction")
            with zipfile.ZipFile(zip_path, "r") as zip_file:
                _process_zip_file(zip_file, temp_dir, options, stats)

        # Log final statistics
        _log_import_statistics(stats)

        return {"message": "Backup imported successfully"}

    except zipfile.BadZipFile:
        logger.error("Invalid zip file provided for import")
        raise HTTPException(status_code=400, detail="Invalid zip file") from None

    except Exception as e:
        logger.exception(f"Error importing backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing backup: {str(e)}") from e
