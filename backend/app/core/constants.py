"""
This module contains constants for the FastAPI app.
"""

import os
from pathlib import Path

# Create necessary directories
MAPS_DIR = Path(__file__).parent.parent.parent.parent / "backend" / "maps"
SCENES_DIR = Path(__file__).parent.parent.parent.parent / "backend" / "scenes"
# Define the path to the sounds directory
SOUNDS_DIR = Path(__file__).parent.parent.parent.parent / "backend" / "sounds"

# Ensure directories exist
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(SCENES_DIR, exist_ok=True)
