"""
This module contains the configuration for the FastAPI app.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .connection_manager import ConnectionManager


def create_app() -> FastAPI:
    """
    Create a FastAPI app instance.

    Returns:
        FastAPI: The FastAPI app instance.
    """
    app = FastAPI()

    # Enable CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.connection_manager = ConnectionManager()

    return app
