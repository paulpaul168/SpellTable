"""
Campaign routes for managing campaigns and user assignments.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user, require_admin_role
from ..core.database import get_db
from ..models.campaign import (
    Campaign,
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
)
from ..models.user import User, UserResponse

router = APIRouter()


@router.post("/", response_model=CampaignResponse)
async def create_campaign(
    campaign: CampaignCreate,
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """Create a new campaign (admin only)."""
    # Check if campaign name already exists
    existing_campaign = (
        db.query(Campaign).filter(Campaign.name == campaign.name).first()
    )
    if existing_campaign:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign name already exists",
        )

    # Create new campaign
    db_campaign = Campaign(
        name=campaign.name, description=campaign.description, created_by=current_user.id
    )

    # Add users to campaign if specified
    if campaign.user_ids:
        users = db.query(User).filter(User.id.in_(campaign.user_ids)).all()
        db_campaign.users = users

    # Add the creator to the campaign if not already included
    if current_user not in db_campaign.users:
        db_campaign.users.append(current_user)

    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)

    # Return with user count
    user_count = len(db_campaign.users)
    campaign_dict = {
        "id": db_campaign.id,
        "name": db_campaign.name,
        "description": db_campaign.description,
        "is_active": db_campaign.is_active,
        "created_by": db_campaign.created_by,
        "created_at": db_campaign.created_at,
        "updated_at": db_campaign.updated_at,
        "user_count": user_count,
    }
    return CampaignResponse(**campaign_dict)


@router.get("/", response_model=List[CampaignResponse])
async def get_campaigns(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get campaigns for the current user."""
    if current_user.role == "admin":
        # Admins can see all campaigns
        campaigns = db.query(Campaign).all()
    else:
        # Regular users can only see campaigns they're assigned to
        campaigns = current_user.campaigns

    result = []
    for campaign in campaigns:
        user_count = len(campaign.users)
        result.append(
            CampaignResponse(
                id=campaign.id,
                name=campaign.name,
                description=campaign.description,
                is_active=campaign.is_active,
                created_by=campaign.created_by,
                created_at=campaign.created_at,
                updated_at=campaign.updated_at,
                user_count=user_count,
            )
        )

    return result


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get a specific campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    # Check if user has access to this campaign
    if current_user.role != "admin" and current_user not in campaign.users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this campaign",
        )

    user_count = len(campaign.users)
    return CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        description=campaign.description,
        is_active=campaign.is_active,
        created_by=campaign.created_by,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        user_count=user_count,
    )


@router.get("/{campaign_id}/users", response_model=List[UserResponse])
async def get_campaign_users(
    campaign_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get users assigned to a specific campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    # Check if user has access to this campaign
    if current_user.role != "admin" and current_user not in campaign.users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this campaign",
        )

    return [UserResponse.from_orm(user) for user in campaign.users]


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: int,
    campaign_update: CampaignUpdate,
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """Update a campaign (admin only)."""
    db_campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    # Update fields if provided
    if campaign_update.name is not None:
        # Check if new name already exists
        existing_campaign = (
            db.query(Campaign)
            .filter(Campaign.name == campaign_update.name, Campaign.id != campaign_id)
            .first()
        )
        if existing_campaign:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign name already exists",
            )
        db_campaign.name = campaign_update.name

    if campaign_update.description is not None:
        db_campaign.description = campaign_update.description

    if campaign_update.is_active is not None:
        db_campaign.is_active = campaign_update.is_active

    if campaign_update.user_ids is not None:
        # Update campaign users
        users = db.query(User).filter(User.id.in_(campaign_update.user_ids)).all()
        db_campaign.users = users
        # Only ensure the creator is in the campaign if they're not already there
        # This allows removing users but prevents the creator from being removed
        if (
            current_user.id == db_campaign.created_by
            and current_user not in db_campaign.users
        ):
            db_campaign.users.append(current_user)

    db.commit()
    db.refresh(db_campaign)

    user_count = len(db_campaign.users)
    return CampaignResponse(
        id=db_campaign.id,
        name=db_campaign.name,
        description=db_campaign.description,
        is_active=db_campaign.is_active,
        created_by=db_campaign.created_by,
        created_at=db_campaign.created_at,
        updated_at=db_campaign.updated_at,
        user_count=user_count,
    )


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """Delete a campaign (admin only)."""
    db_campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found"
        )

    db.delete(db_campaign)
    db.commit()
    return {"message": "Campaign deleted successfully"}
