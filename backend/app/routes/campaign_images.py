"""
Campaign images routes for managing image uploads.
"""

import os
import uuid
from typing import List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.campaign import Campaign
from ..models.campaign_images import (
    CampaignImage,
    CampaignImageCreate,
    CampaignImageResponse,
)
from ..models.user import User

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOADS_DIR = Path("campaign_images")
UPLOADS_DIR.mkdir(exist_ok=True)


@router.post("/campaigns/{campaign_id}/images", response_model=CampaignImageResponse)
async def upload_campaign_image(
    campaign_id: int,
    file: UploadFile = File(...),
    description: str = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Upload an image for a campaign."""
    # Check if user has access to this campaign
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    if current_user.role != "admin" and current_user not in campaign.users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this campaign",
        )

    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files (JPEG, PNG, GIF, WebP) are allowed",
        )

    # Validate file size (10MB limit)
    max_size = 10 * 1024 * 1024  # 10MB
    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 10MB",
        )

    try:
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOADS_DIR / unique_filename

        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Create database record
        db_image = CampaignImage(
            campaign_id=campaign_id,
            uploaded_by=current_user.id,
            filename=unique_filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=len(content),
            mime_type=file.content_type,
            description=description,
        )

        db.add(db_image)
        db.commit()
        db.refresh(db_image)

        image_dict = {
            "id": db_image.id,
            "campaign_id": db_image.campaign_id,
            "uploaded_by": db_image.uploaded_by,
            "filename": db_image.filename,
            "original_filename": db_image.original_filename,
            "file_path": db_image.file_path,
            "file_size": db_image.file_size,
            "mime_type": db_image.mime_type,
            "description": db_image.description,
            "created_at": db_image.created_at,
            "uploader_name": current_user.username,
            "url": f"/campaigns/{campaign_id}/images/{db_image.id}/file",
        }
        return CampaignImageResponse(**image_dict)

    except Exception as e:
        # Clean up file if database operation fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}",
        )


@router.get(
    "/campaigns/{campaign_id}/images", response_model=List[CampaignImageResponse]
)
async def get_campaign_images(
    campaign_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get all images for a campaign."""
    # Check if user has access to this campaign
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    if current_user.role != "admin" and current_user not in campaign.users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this campaign",
        )

    # Get images with uploader information
    images = (
        db.query(CampaignImage)
        .filter(CampaignImage.campaign_id == campaign_id)
        .order_by(CampaignImage.created_at.desc())
        .all()
    )

    result = []
    for image in images:
        uploader = db.query(User).filter(User.id == image.uploaded_by).first()
        result.append(
            CampaignImageResponse(
                id=image.id,
                campaign_id=image.campaign_id,
                uploaded_by=image.uploaded_by,
                filename=image.filename,
                original_filename=image.original_filename,
                file_path=image.file_path,
                file_size=image.file_size,
                mime_type=image.mime_type,
                description=image.description,
                created_at=image.created_at,
                uploader_name=uploader.username if uploader else "Unknown",
                url=f"/campaigns/{campaign_id}/images/{image.id}/file",
            )
        )

    return result


@router.get("/campaigns/{campaign_id}/images/{image_id}/file")
async def get_campaign_image_file(
    campaign_id: int,
    image_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get the actual image file."""
    # Check if user has access to this campaign
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    if current_user.role != "admin" and current_user not in campaign.users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this campaign",
        )

    # Get the image
    image = (
        db.query(CampaignImage)
        .filter(CampaignImage.id == image_id, CampaignImage.campaign_id == campaign_id)
        .first()
    )
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Image not found"
        )

    # Check if file exists
    file_path = Path(image.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found"
        )

    return FileResponse(
        path=file_path,
        media_type=image.mime_type,
        filename=image.original_filename,
    )


@router.delete("/campaigns/{campaign_id}/images/{image_id}")
async def delete_campaign_image(
    campaign_id: int,
    image_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a campaign image (only uploader or admin can delete)."""
    # Check if user has access to this campaign
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    if current_user.role != "admin" and current_user not in campaign.users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this campaign",
        )

    # Get the image
    image = (
        db.query(CampaignImage)
        .filter(CampaignImage.id == image_id, CampaignImage.campaign_id == campaign_id)
        .first()
    )
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Image not found"
        )

    # Check if user can delete this image (uploader or admin)
    if current_user.role != "admin" and image.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the uploader or admin can delete this image",
        )

    try:
        # Delete file from filesystem
        file_path = Path(image.file_path)
        if file_path.exists():
            file_path.unlink()

        # Delete from database
        db.delete(image)
        db.commit()

        return {"message": "Image deleted successfully"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete image: {str(e)}",
        )
