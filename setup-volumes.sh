#!/bin/bash

# Setup script for SpellTable local volumes
# This script creates the necessary directories for Docker volume mounts
# and sets appropriate permissions

echo "Setting up SpellTable local volumes..."

# Create directories if they don't exist
mkdir -p data
mkdir -p logs
mkdir -p maps
mkdir -p scenes
mkdir -p sounds
mkdir -p campaign_images

# Set permissions (adjust user/group as needed for your system)
# For Linux systems, you might need to use the Docker user ID
# For macOS/Windows, these permissions should work fine

echo "Setting directory permissions..."

# Make directories readable and writable by the current user
chmod 755 data
chmod 755 logs
chmod 755 maps
chmod 755 scenes
chmod 755 sounds
chmod 755 campaign_images

# Create .gitkeep files to ensure directories are tracked by git
touch data/.gitkeep
touch logs/.gitkeep
touch maps/.gitkeep
touch scenes/.gitkeep
touch sounds/.gitkeep
touch campaign_images/.gitkeep

echo "Local volumes setup complete!"
echo ""
echo "Directory structure:"
echo "  ./data/           - Database and application data"
echo "  ./logs/           - Application logs"
echo "  ./maps/           - Map files"
echo "  ./scenes/         - Scene files"
echo "  ./sounds/         - Audio files"
echo "  ./campaign_images/ - Campaign images"
echo ""
echo "These directories are now mounted as volumes in Docker containers."
echo "All data will persist across container restarts and updates."
