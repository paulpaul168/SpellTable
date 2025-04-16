"""
This module is the entry point for the FastAPI app.
"""

import uvicorn
from fastapi import FastAPI
from loguru import logger

from app.core.config import create_app
from app.core.logging import setup_logger
from app.routes import audio, maps, scenes, websocket


def get_application() -> FastAPI:
    """
    Create and configure the FastAPI application.
    This is separated to avoid multiple initializations during hot reloading.
    """
    # Initialize logger as the first operation
    setup_logger()

    logger.info("Initializing FastAPI application")
    local_app = create_app()

    # Include routers
    logger.info("Registering application routes")
    local_app.include_router(websocket.router)
    local_app.include_router(scenes.router, prefix="/scenes")
    local_app.include_router(audio.router, prefix="/audio")
    local_app.include_router(maps.router, prefix="/maps")

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


if __name__ == "__main__":
    logger.info("Starting uvicorn server")
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
