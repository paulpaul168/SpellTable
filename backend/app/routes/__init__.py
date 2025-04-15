from .maps import router as maps_router
from .websocket import router as websocket_router
from .scenes import router as scenes_router
from .audio import router as audio_router

__all__ = ["maps_router", "websocket_router", "scenes_router", "audio_router"]
