from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Create maps directory if it doesn't exist
MAPS_DIR = "maps"
os.makedirs(MAPS_DIR, exist_ok=True)


def create_app() -> FastAPI:
    app = FastAPI()

    # Enable CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app
