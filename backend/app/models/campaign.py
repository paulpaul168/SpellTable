"""
Campaign model and schemas.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    ForeignKey,
    Table,
)
from sqlalchemy.orm import relationship

from .user import Base


# Association table for many-to-many relationship between campaigns and users
campaign_users = Table(
    "campaign_users",
    Base.metadata,
    Column("campaign_id", Integer, ForeignKey("campaigns.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)


class Campaign(Base):
    """Campaign model for database."""

    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    users = relationship("User", secondary=campaign_users, back_populates="campaigns")
    creator = relationship("User", foreign_keys=[created_by])
    notes = relationship(
        "CampaignNote", back_populates="campaign", cascade="all, delete-orphan"
    )
    images = relationship(
        "CampaignImage", back_populates="campaign", cascade="all, delete-orphan"
    )


class CampaignCreate(BaseModel):
    """Schema for creating a new campaign."""

    name: str
    description: Optional[str] = None
    user_ids: List[int] = []


class CampaignUpdate(BaseModel):
    """Schema for updating a campaign."""

    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    user_ids: Optional[List[int]] = None


class CampaignResponse(BaseModel):
    """Schema for campaign response."""

    id: int
    name: str
    description: Optional[str]
    is_active: bool
    created_by: int
    created_at: datetime
    updated_at: datetime
    user_count: int = 0

    class Config:
        from_attributes = True
