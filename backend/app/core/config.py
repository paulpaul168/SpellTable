"""
This module contains the configuration for the FastAPI app.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .connection_manager import ConnectionManager


def create_app() -> FastAPI:
    """
    Create a FastAPI app instance.

    Returns:
        FastAPI: The FastAPI app instance.
    """

    logger.info("Creating FastAPI application")
    app = FastAPI()

    # Enable CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    logger.info("Initializing connection manager")
    app.state.connection_manager = ConnectionManager()

    logger.info("FastAPI application created successfully")
    return app
