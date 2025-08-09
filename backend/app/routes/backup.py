"""
This module contains the backup routes for the FastAPI app.
"""

import os
import shutil
import tempfile
import zipfile
import json
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile, Depends
from fastapi.responses import FileResponse
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.constants import MAPS_DIR, SCENES_DIR, SOUNDS_DIR, CAMPAIGN_IMAGES_DIR
from ..core.database import get_db
from ..models.campaign import Campaign
from ..models.campaign_notes import CampaignNote
from ..models.campaign_images import CampaignImage

router = APIRouter()


class BackupOptions(BaseModel):
    """Options for backup selection."""

    maps: bool = True
    scenes: bool = True
    audio: bool = True
    campaigns: bool = True
    diary: bool = True
    users: bool = True
    include_folders: Optional[List[str]] = None


class ImportStats(BaseModel):
    """Statistics for import operations."""

    extracted_files: int = 0
    processed_files: Dict[str, int] = {"maps": 0, "scenes": 0, "sounds": 0, "campaigns": 0, "diary": 0, "users": 0, "other": 0}
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
    skip_campaigns = content_type == "campaigns" and not options.get("campaigns", True)
    skip_diary = content_type == "diary" and not options.get("diary", True)
    skip_users = content_type == "users" and not options.get("users", True)

    return skip_maps or skip_scenes or skip_audio or skip_campaigns or skip_diary or skip_users


def _get_destination_directory(content_type: str) -> Optional[str]:
    """Get the destination directory for a given content type."""
    content_map = {
        "maps": str(MAPS_DIR),
        "scenes": str(SCENES_DIR),
        "sounds": str(SOUNDS_DIR),
        "campaign_images": str(CAMPAIGN_IMAGES_DIR),
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


def _add_campaign_data_to_zip(zip_file: zipfile.ZipFile, db: Session) -> None:
    """Add campaign data to the zip file."""
    try:
        # Get all campaigns with their users
        campaigns = db.query(Campaign).all()
        campaign_data = []
        
        for campaign in campaigns:
            campaign_dict = {
                "id": campaign.id,
                "name": campaign.name,
                "description": campaign.description,
                "is_active": campaign.is_active,
                "created_by": campaign.created_by,
                "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
                "updated_at": campaign.updated_at.isoformat() if campaign.updated_at else None,
                "users": [{"id": user.id, "username": user.username} for user in campaign.users]
            }
            campaign_data.append(campaign_dict)
        
        # Add campaign data as JSON
        zip_file.writestr("campaigns/campaigns.json", json.dumps(campaign_data, indent=2))
        logger.info(f"Added {len(campaign_data)} campaigns to backup")
        
    except Exception as e:
        logger.error(f"Error adding campaign data to backup: {e}")


def _add_diary_content_to_zip(zip_file: zipfile.ZipFile, db: Session) -> None:
    """Add diary content (campaign notes and images) to the zip file."""
    try:
        # Get all campaign notes
        notes = db.query(CampaignNote).all()
        notes_data = []
        
        for note in notes:
            note_dict = {
                "id": note.id,
                "campaign_id": note.campaign_id,
                "title": note.title,
                "content": note.content,
                "created_by": note.created_by,
                "created_at": note.created_at.isoformat() if note.created_at else None,
                "updated_at": note.updated_at.isoformat() if note.updated_at else None
            }
            notes_data.append(note_dict)
        
        # Add notes data as JSON
        zip_file.writestr("diary/notes.json", json.dumps(notes_data, indent=2))
        logger.info(f"Added {len(notes_data)} notes to backup")
        
        # Get all campaign images metadata
        images = db.query(CampaignImage).all()
        images_data = []
        
        for image in images:
            image_dict = {
                "id": image.id,
                "campaign_id": image.campaign_id,
                "uploaded_by": image.uploaded_by,
                "filename": image.filename,
                "original_filename": image.original_filename,
                "file_size": image.file_size,
                "mime_type": image.mime_type,
                "description": image.description,
                "created_at": image.created_at.isoformat() if image.created_at else None
            }
            images_data.append(image_dict)
            
            # Add the actual image file if it exists
            image_path = image.file_path
            if os.path.exists(image_path):
                zip_file.write(image_path, f"diary/images/{image.filename}")
        
        # Add images metadata as JSON
        zip_file.writestr("diary/images_metadata.json", json.dumps(images_data, indent=2))
        logger.info(f"Added {len(images_data)} images metadata to backup")
        
    except Exception as e:
        logger.error(f"Error adding diary content to backup: {e}")


def _add_users_to_zip(zip_file: zipfile.ZipFile, db: Session) -> None:
    """Add user data to the zip file."""
    try:
        # Get all users including password hashes for complete backup
        from ..models.user import User
        users = db.query(User).all()
        users_data = []
        
        for user in users:
            user_dict = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                "password_hash": user.password_hash,  # Include password hash for complete backup
                "campaign_ids": [campaign.id for campaign in user.campaigns]
            }
            users_data.append(user_dict)
        
        # Add user data as JSON
        zip_file.writestr("users/users.json", json.dumps(users_data, indent=2))
        logger.info(f"Added {len(users_data)} users to backup (including password hashes)")
        
    except Exception as e:
        logger.error(f"Error adding user data to backup: {e}")


def _import_users_from_backup(zip_file: zipfile.ZipFile, db: Session) -> None:
    """Import user data from backup zip file."""
    try:
        # Check if users.json exists in the backup
        users_file_path = "users/users.json"
        if users_file_path not in zip_file.namelist():
            logger.info("No users data found in backup")
            return

        # Extract and read users data
        users_data = json.loads(zip_file.read(users_file_path).decode('utf-8'))
        logger.info(f"Found {len(users_data)} users in backup")

        from ..models.user import User
        
        for user_data in users_data:
            # Check if user already exists
            existing_user = db.query(User).filter(User.username == user_data['username']).first()
            
            if existing_user:
                # Update existing user
                existing_user.email = user_data.get('email', existing_user.email)
                existing_user.role = user_data.get('role', existing_user.role)
                existing_user.is_active = user_data.get('is_active', existing_user.is_active)
                existing_user.password_hash = user_data.get('password_hash', existing_user.password_hash)
                logger.info(f"Updated existing user: {user_data['username']}")
            else:
                # Create new user
                new_user = User(
                    username=user_data['username'],
                    email=user_data.get('email', ''),
                    role=user_data.get('role', 'user'),
                    is_active=user_data.get('is_active', True),
                    password_hash=user_data.get('password_hash', '')
                )
                db.add(new_user)
                logger.info(f"Created new user: {user_data['username']}")

        db.commit()
        logger.info(f"Successfully imported {len(users_data)} users")
        
    except Exception as e:
        logger.error(f"Error importing users from backup: {e}")
        db.rollback()
        raise


def _import_campaigns_from_backup(zip_file: zipfile.ZipFile, db: Session) -> None:
    """Import campaign data from backup zip file."""
    try:
        # Check if campaigns.json exists in the backup
        campaigns_file_path = "campaigns/campaigns.json"
        if campaigns_file_path not in zip_file.namelist():
            logger.info("No campaigns data found in backup")
            return

        # Extract and read campaigns data
        campaigns_data = json.loads(zip_file.read(campaigns_file_path).decode('utf-8'))
        logger.info(f"Found {len(campaigns_data)} campaigns in backup")

        from ..models.campaign import Campaign
        from ..models.user import User
        
        for campaign_data in campaigns_data:
            # Check if campaign already exists
            existing_campaign = db.query(Campaign).filter(Campaign.name == campaign_data['name']).first()
            
            if existing_campaign:
                # Update existing campaign
                existing_campaign.description = campaign_data.get('description', existing_campaign.description)
                existing_campaign.is_active = campaign_data.get('is_active', existing_campaign.is_active)
                logger.info(f"Updated existing campaign: {campaign_data['name']}")
            else:
                # Create new campaign
                new_campaign = Campaign(
                    name=campaign_data['name'],
                    description=campaign_data.get('description', ''),
                    is_active=campaign_data.get('is_active', True),
                    created_by=campaign_data.get('created_by', 1)  # Default to first user
                )
                db.add(new_campaign)
                db.flush()  # Get the ID
                
                # Add users to campaign if specified
                if 'users' in campaign_data:
                    for user_info in campaign_data['users']:
                        user = db.query(User).filter(User.username == user_info['username']).first()
                        if user:
                            new_campaign.users.append(user)
                
                logger.info(f"Created new campaign: {campaign_data['name']}")

        db.commit()
        logger.info(f"Successfully imported {len(campaigns_data)} campaigns")
        
    except Exception as e:
        logger.error(f"Error importing campaigns from backup: {e}")
        db.rollback()
        raise


def _import_diary_from_backup(zip_file: zipfile.ZipFile, db: Session) -> None:
    """Import diary content (notes and images) from backup zip file."""
    try:
        from ..models.campaign_notes import CampaignNote
        from ..models.campaign_images import CampaignImage
        
        # Import notes
        notes_file_path = "diary/notes.json"
        if notes_file_path in zip_file.namelist():
            notes_data = json.loads(zip_file.read(notes_file_path).decode('utf-8'))
            logger.info(f"Found {len(notes_data)} notes in backup")
            
            for note_data in notes_data:
                # Check if note already exists
                existing_note = db.query(CampaignNote).filter(
                    CampaignNote.campaign_id == note_data['campaign_id'],
                    CampaignNote.title == note_data['title']
                ).first()
                
                if not existing_note:
                    # Create new note
                    new_note = CampaignNote(
                        campaign_id=note_data['campaign_id'],
                        title=note_data['title'],
                        content=note_data['content'],
                        created_by=note_data.get('created_by', 1)
                    )
                    db.add(new_note)
                    logger.info(f"Created new note: {note_data['title']}")
            
            db.commit()
            logger.info(f"Successfully imported {len(notes_data)} notes")
        
        # Import images metadata (actual files are handled by file processing)
        images_file_path = "diary/images_metadata.json"
        if images_file_path in zip_file.namelist():
            images_data = json.loads(zip_file.read(images_file_path).decode('utf-8'))
            logger.info(f"Found {len(images_data)} images metadata in backup")
            
            for image_data in images_data:
                # Check if image already exists
                existing_image = db.query(CampaignImage).filter(
                    CampaignImage.campaign_id == image_data['campaign_id'],
                    CampaignImage.filename == image_data['filename']
                ).first()
                
                if not existing_image:
                    # Create new image record
                    new_image = CampaignImage(
                        campaign_id=image_data['campaign_id'],
                        uploaded_by=image_data.get('uploaded_by', 1),
                        filename=image_data['filename'],
                        original_filename=image_data['original_filename'],
                        file_path=image_data['file_path'],
                        file_size=image_data['file_size'],
                        mime_type=image_data['mime_type'],
                        description=image_data.get('description', '')
                    )
                    db.add(new_image)
                    logger.info(f"Created new image record: {image_data['original_filename']}")
            
            db.commit()
            logger.info(f"Successfully imported {len(images_data)} images metadata")
        
    except Exception as e:
        logger.error(f"Error importing diary content from backup: {e}")
        db.rollback()
        raise


@router.get("/export")
async def export_backup(
    background_tasks: BackgroundTasks,
    maps: bool = Query(True),
    scenes: bool = Query(True),
    audio: bool = Query(True),
    campaigns: bool = Query(True),
    diary: bool = Query(True),
    users: bool = Query(True),
    include_folders: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Export selected content (maps, scenes, audio, campaigns, and/or diary) as a zip backup.

    Args:
        background_tasks: Background tasks for cleanup
        maps: Whether to include maps in the backup
        scenes: Whether to include scenes in the backup
        audio: Whether to include audio in the backup
        campaigns: Whether to include campaign data in the backup
        diary: Whether to include diary content (notes and images) in the backup
        users: Whether to include user data in the backup
        include_folders: Optional list of folder names to include
        db: Database session

    Returns:
        FileResponse with the generated zip file
    """
    # Convert the query parameters to a BackupOptions object
    options = BackupOptions(maps=maps, scenes=scenes, audio=audio, campaigns=campaigns, diary=diary, users=users, include_folders=include_folders)

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

            if options.campaigns:
                logger.info("Adding campaign data to backup")
                _add_campaign_data_to_zip(zip_file, db)

            if options.diary:
                logger.info("Adding diary content to backup")
                _add_diary_content_to_zip(zip_file, db)

            if options.users:
                logger.info("Adding user data to backup")
                _add_users_to_zip(zip_file, db)

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
    campaigns: bool = Form(True),
    diary: bool = Form(True),
    users: bool = Form(True),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """
    Import a backup file with selected options.

    Args:
        backup_file: The backup file to import
        maps: Whether to import maps
        scenes: Whether to import scenes
        audio: Whether to import audio
        campaigns: Whether to import campaign data
        diary: Whether to import diary content
        users: Whether to import user data
        db: Database session

    Returns:
        Dictionary with import status
    """
    if not backup_file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Backup file must be a ZIP file")

    options = {
        "maps": maps,
        "scenes": scenes,
        "audio": audio,
        "campaigns": campaigns,
        "diary": diary,
        "users": users,
    }

    stats = ImportStats()

    try:
        # Create temporary directory for extraction
        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info(f"Created temporary directory: {temp_dir}")

            # Save uploaded file
            zip_path, file_size = await _save_uploaded_file_async(backup_file, temp_dir)
            stats.total_size = file_size

            # Extract and process zip file
            with zipfile.ZipFile(zip_path, 'r') as zip_file:
                _process_zip_file(zip_file, temp_dir, options, stats)
                
                # Handle special data types that need database operations
                if options.get("users", False):
                    logger.info("Importing user data from backup")
                    _import_users_from_backup(zip_file, db)

                if options.get("campaigns", False):
                    logger.info("Importing campaign data from backup")
                    _import_campaigns_from_backup(zip_file, db)

                if options.get("diary", False):
                    logger.info("Importing diary content from backup")
                    _import_diary_from_backup(zip_file, db)

            # Log import statistics
            _log_import_statistics(stats)

        return {
            "message": "Backup imported successfully",
            "extracted_files": stats.extracted_files,
            "processed_files": stats.processed_files,
            "total_size": stats.total_size,
        }

    except Exception as e:
        logger.exception(f"Error importing backup: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing backup: {str(e)}") from e
