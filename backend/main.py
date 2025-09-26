"""
This module is the entry point for the FastAPI app.
"""

import uvicorn
from fastapi import FastAPI
from loguru import logger

from app.core.config import create_app
from app.core.database import init_db
from app.core.logging import setup_logger
from app.routes import (
    audio,
    auth,
    backup,
    campaigns,
    campaign_notes,
    campaign_images,
    maps,
    scenes,
    websocket,
    monsters,
)


def get_application() -> FastAPI:
    """
    Create and configure the FastAPI application.
    This is separated to avoid multiple initializations during hot reloading.
    """
    # Initialize logger as the first operation
    setup_logger()

    logger.info("Initializing FastAPI application")
    local_app = create_app()

    # Initialize database
    logger.info("Initializing database")
    init_db()

    # Include routers
    logger.info("Registering application routes")
    local_app.include_router(auth.router, prefix="/auth", tags=["authentication"])
    local_app.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
    local_app.include_router(campaign_notes.router, tags=["campaign_notes"])
    local_app.include_router(campaign_images.router, tags=["campaign_images"])
    local_app.include_router(websocket.router)
    local_app.include_router(scenes.router, prefix="/scenes")
    local_app.include_router(audio.router, prefix="/audio")
    local_app.include_router(maps.router, prefix="/maps")
    local_app.include_router(backup.router, prefix="/backup")
    local_app.include_router(monsters.router, prefix="/monsters")

    return local_app


# Create the application instance
app = get_application()


@app.get("/")
async def root() -> dict[str, str]:
    """
    Root endpoint for the FastAPI app.
    """
    logger.debug("Root endpoint accessed")
    return {"message": "Welcome to SpellTable API"}


@app.get("/health")
async def health_check() -> dict[str, str]:
    """
    Health check endpoint for monitoring the application status.
    """
    logger.debug("Health check endpoint accessed")
    return {"status": "ok"}


if __name__ == "__main__":
    logger.info("Starting uvicorn server")
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
