"""
Campaign notes model and schemas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from .user import Base


class CampaignNote(Base):
    """Campaign note model for database."""

    __tablename__ = "campaign_notes"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    campaign = relationship("Campaign", back_populates="notes")
    author = relationship("User", back_populates="campaign_notes")


class CampaignNoteCreate(BaseModel):
    """Schema for creating a new campaign note."""

    title: str
    content: str


class CampaignNoteUpdate(BaseModel):
    """Schema for updating a campaign note."""

    title: Optional[str] = None
    content: Optional[str] = None


class CampaignNoteResponse(BaseModel):
    """Schema for campaign note response."""

    id: int
    campaign_id: int
    author_id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
    author_name: str

    class Config:
        from_attributes = True
