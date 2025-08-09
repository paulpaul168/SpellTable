"""
Campaign notes routes for managing diary-style notes.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.campaign import Campaign
from ..models.campaign_notes import (
    CampaignNote,
    CampaignNoteCreate,
    CampaignNoteResponse,
    CampaignNoteUpdate,
)
from ..models.user import User

router = APIRouter()


@router.post("/campaigns/{campaign_id}/notes", response_model=CampaignNoteResponse)
async def create_campaign_note(
    campaign_id: int,
    note: CampaignNoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new campaign note."""
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

    # Create new note
    db_note = CampaignNote(
        campaign_id=campaign_id,
        author_id=current_user.id,
        title=note.title,
        content=note.content,
    )

    db.add(db_note)
    db.commit()
    db.refresh(db_note)

    return CampaignNoteResponse(
        id=db_note.id,
        campaign_id=db_note.campaign_id,
        author_id=db_note.author_id,
        title=db_note.title,
        content=db_note.content,
        created_at=db_note.created_at,
        updated_at=db_note.updated_at,
        author_name=current_user.username,
    )


@router.get("/campaigns/{campaign_id}/notes", response_model=List[CampaignNoteResponse])
async def get_campaign_notes(
    campaign_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get all notes for a campaign."""
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

    # Get notes with author information
    notes = (
        db.query(CampaignNote)
        .filter(CampaignNote.campaign_id == campaign_id)
        .order_by(CampaignNote.created_at.desc())
        .all()
    )

    result = []
    for note in notes:
        author = db.query(User).filter(User.id == note.author_id).first()
        result.append(
            CampaignNoteResponse(
                id=note.id,
                campaign_id=note.campaign_id,
                author_id=note.author_id,
                title=note.title,
                content=note.content,
                created_at=note.created_at,
                updated_at=note.updated_at,
                author_name=author.username if author else "Unknown",
            )
        )

    return result


@router.get(
    "/campaigns/{campaign_id}/notes/{note_id}", response_model=CampaignNoteResponse
)
async def get_campaign_note(
    campaign_id: int,
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get a specific campaign note."""
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

    # Get the note
    note = (
        db.query(CampaignNote)
        .filter(CampaignNote.id == note_id, CampaignNote.campaign_id == campaign_id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    author = db.query(User).filter(User.id == note.author_id).first()
    return CampaignNoteResponse(
        id=note.id,
        campaign_id=note.campaign_id,
        author_id=note.author_id,
        title=note.title,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
        author_name=author.username if author else "Unknown",
    )


@router.put(
    "/campaigns/{campaign_id}/notes/{note_id}", response_model=CampaignNoteResponse
)
async def update_campaign_note(
    campaign_id: int,
    note_id: int,
    note_update: CampaignNoteUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update a campaign note (only author or admin can update)."""
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

    # Get the note
    note = (
        db.query(CampaignNote)
        .filter(CampaignNote.id == note_id, CampaignNote.campaign_id == campaign_id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    # Check if user can edit this note (author or admin)
    if current_user.role != "admin" and note.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or admin can edit this note",
        )

    # Update note fields
    if note_update.title is not None:
        note.title = note_update.title
    if note_update.content is not None:
        note.content = note_update.content

    db.commit()
    db.refresh(note)

    author = db.query(User).filter(User.id == note.author_id).first()
    return CampaignNoteResponse(
        id=note.id,
        campaign_id=note.campaign_id,
        author_id=note.author_id,
        title=note.title,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
        author_name=author.username if author else "Unknown",
    )


@router.delete("/campaigns/{campaign_id}/notes/{note_id}")
async def delete_campaign_note(
    campaign_id: int,
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a campaign note (only author or admin can delete)."""
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

    # Get the note
    note = (
        db.query(CampaignNote)
        .filter(CampaignNote.id == note_id, CampaignNote.campaign_id == campaign_id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    # Check if user can delete this note (author or admin)
    if current_user.role != "admin" and note.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or admin can delete this note",
        )

    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}
