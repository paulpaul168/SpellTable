"""
This module contains constants for the FastAPI app.
"""

import os

# Create necessary directories
MAPS_DIR = "maps"
SCENES_DIR = "scenes"

# Ensure directories exist
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(SCENES_DIR, exist_ok=True)
