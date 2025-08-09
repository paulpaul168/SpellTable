"""
This module contains the routes for the FastAPI app.
"""

from .audio import router as audio_router
from .auth import router as auth_router
from .backup import router as backup_router
from .campaigns import router as campaigns_router
from .campaign_notes import router as campaign_notes_router
from .maps import router as maps_router
from .scenes import router as scenes_router
from .websocket import router as websocket_router

__all__ = [
    "auth_router",
    "campaigns_router",
    "campaign_notes_router",
    "maps_router",
    "websocket_router",
    "scenes_router",
    "audio_router",
    "backup_router",
]
