"""
This module contains constants for the FastAPI app.
"""

import os
from pathlib import Path

# Create necessary directories
MAPS_DIR = "maps"
SCENES_DIR = "scenes"
CAMPAIGN_IMAGES_DIR = "campaign_images"
MONSTERS_DIR = "monsters"
# Define the path to the sounds directory
SOUNDS_DIR = Path(__file__).parent.parent.parent.parent / "backend" / "sounds"

# Ensure directories exist
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(SCENES_DIR, exist_ok=True)
os.makedirs(CAMPAIGN_IMAGES_DIR, exist_ok=True)
os.makedirs(MONSTERS_DIR, exist_ok=True)
