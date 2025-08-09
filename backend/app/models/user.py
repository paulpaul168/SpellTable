"""
User model and authentication schemas.
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, JSON
from sqlalchemy.orm import relationship

from ..core.database import Base


class UserRole(str, Enum):
    """User roles enumeration."""

    ADMIN = "admin"
    VIEWER = "viewer"


class User(Base):
    """User model for database."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Admin state storage (JSON field for flexible state data)
    admin_state = Column(JSON, nullable=True)

    # Relationships
    campaigns = relationship(
        "Campaign", secondary="campaign_users", back_populates="users"
    )
    campaign_notes = relationship("CampaignNote", back_populates="author")
    campaign_images = relationship("CampaignImage", back_populates="uploader")


class UserCreate(BaseModel):
    """Schema for creating a new user."""

    username: str
    email: str
    password: str
    role: UserRole = UserRole.VIEWER


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    admin_state: Optional[dict] = None


class UserResponse(BaseModel):
    """Schema for user response (without password)."""

    id: int
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    admin_state: Optional[dict] = None

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """Schema for user login."""

    username: str
    password: str


class Token(BaseModel):
    """Schema for authentication token."""

    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    """Schema for token data."""

    username: Optional[str] = None


class AdminState(BaseModel):
    """Schema for admin state data."""

    last_map_id: Optional[str] = None
    last_scene_id: Optional[str] = None
    display_scale: Optional[float] = 1.0
    grid_settings: Optional[dict] = None
    ui_preferences: Optional[dict] = None
