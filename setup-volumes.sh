#!/bin/bash

# Setup script for SpellTable local volumes under storage/
# Prefer: ./scripts/migrate-to-storage.sh if you already have data in the old layout.

echo "Setting up SpellTable storage volumes..."

mkdir -p storage/data
mkdir -p storage/logs
mkdir -p storage/maps
mkdir -p storage/scenes
mkdir -p storage/sounds
mkdir -p storage/campaign_images
mkdir -p storage/monsters

echo "Setting directory permissions..."
chmod 755 storage storage/data storage/logs storage/maps storage/scenes \
  storage/sounds storage/campaign_images storage/monsters

touch storage/data/.gitkeep
touch storage/logs/.gitkeep
touch storage/maps/.gitkeep
touch storage/scenes/.gitkeep
touch storage/sounds/.gitkeep
touch storage/campaign_images/.gitkeep
touch storage/monsters/.gitkeep

echo "Local volumes setup complete!"
echo ""
echo "Directory structure:"
echo "  ./storage/data/             - SQLite DB + optional BYO catalogs"
echo "  ./storage/logs/             - Application logs"
echo "  ./storage/maps/             - Map files"
echo "  ./storage/scenes/           - Scene files"
echo "  ./storage/sounds/           - Audio files"
echo "  ./storage/campaign_images/  - Campaign images"
echo "  ./storage/monsters/         - Local monster JSON library"
echo ""
echo "Existing installs: run ./scripts/migrate-to-storage.sh once."
