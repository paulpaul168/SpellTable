"""
Models package for the application.
"""

from .map import MapData, FolderItem
from .scenes import SceneData, SceneImage, FolderCreateRequest, FolderRenameRequest
from .user import (
    User,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
    Token,
    TokenData,
    UserRole,
    AdminState,
)
from .campaign import (
    Campaign,
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
)
from .campaign_notes import (
    CampaignNote,
    CampaignNoteCreate,
    CampaignNoteUpdate,
    CampaignNoteResponse,
)
from .campaign_images import (
    CampaignImage,
    CampaignImageCreate,
    CampaignImageResponse,
)

__all__ = [
    "MapData",
    "FolderItem",
    "SceneData",
    "SceneImage",
    "FolderCreateRequest",
    "FolderRenameRequest",
    "User",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserLogin",
    "Token",
    "TokenData",
    "UserRole",
    "AdminState",
    "Campaign",
    "CampaignCreate",
    "CampaignUpdate",
    "CampaignResponse",
    "CampaignNote",
    "CampaignNoteCreate",
    "CampaignNoteUpdate",
    "CampaignNoteResponse",
    "CampaignImage",
    "CampaignImageCreate",
    "CampaignImageResponse",
]
