"""
Campaign images model and schemas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from .user import Base


class CampaignImage(Base):
    """Campaign image model for database."""

    __tablename__ = "campaign_images"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="images")
    uploader = relationship("User", back_populates="campaign_images")


class CampaignImageCreate(BaseModel):
    """Schema for creating a new campaign image."""

    original_filename: str
    file_size: int
    mime_type: str
    description: Optional[str] = None


class CampaignImageResponse(BaseModel):
    """Schema for campaign image response."""

    id: int
    campaign_id: int
    uploaded_by: int
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    description: Optional[str]
    created_at: datetime
    uploader_name: str
    url: str

    class Config:
        from_attributes = True
