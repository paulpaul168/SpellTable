# SpellTable Local Volumes Setup

This document explains how SpellTable uses local Docker volumes to persist data across container restarts and updates.

## Overview

SpellTable now uses local path volumes instead of Docker's internal volumes. This means all data is stored directly on your host filesystem in the project directory, making it:

- **Persistent**: Data survives container restarts, updates, and rebuilds
- **Accessible**: Easy to backup, restore, and inspect data
- **Transparent**: You can see exactly what data is stored where

## Directory Structure

After running the setup script, you'll have these directories in your project root:

```
SpellTable/
├── data/              # Database and application data
├── logs/              # Application logs
├── maps/              # Map files uploaded by users
├── scenes/            # Scene files created by users
├── sounds/            # Audio files (music and sound effects)
├── campaign_images/   # Campaign diary images
└── ... (other project files)
```

## Setup Instructions

### 1. Run the Setup Script

```bash
./setup-volumes.sh
```

This script will:
- Create all necessary directories
- Set appropriate permissions
- Add `.gitkeep` files to ensure directories are tracked by git

### 2. Start the Application

```bash
# For development
docker-compose up -d

# For production
docker-compose -f docker-compose.prod.yml up -d
```

## Data Persistence

### What Gets Persisted

- **Database**: SQLite database files in `./data/`
- **User Uploads**: Maps, scenes, and audio files
- **Campaign Data**: Campaign images and metadata
- **Logs**: Application logs for debugging
- **Configuration**: Any persistent configuration files

### What Doesn't Get Persisted

- Container-specific settings
- Temporary files
- Build artifacts

## Backup and Restore

### Manual Backup

You can easily backup all your data by copying the volume directories:

```bash
# Create a backup
tar -czf spelltable-backup-$(date +%Y%m%d).tar.gz data/ maps/ scenes/ sounds/ campaign_images/

# Restore from backup
tar -xzf spelltable-backup-20231201.tar.gz
```

### Using the Built-in Backup System

SpellTable includes a comprehensive backup system in the web interface that can export/import:

- Maps
- Scenes
- Audio files
- Campaign data
- Diary content
- User data (including passwords)

## Troubleshooting

### Permission Issues

If you encounter permission issues on Linux:

```bash
# Find the Docker user ID
docker run --rm -v /etc/passwd:/etc/passwd:ro alpine grep docker /etc/passwd

# Or use your user ID
sudo chown -R $USER:$USER data/ logs/ maps/ scenes/ sounds/ campaign_images/
```

### Data Not Persisting

1. Check that the directories exist and have proper permissions
2. Verify the volume mounts in `docker-compose.yml`
3. Ensure Docker has access to the host directories

### Container Can't Write to Volumes

```bash
# Make directories writable
chmod 755 data/ logs/ maps/ scenes/ sounds/ campaign_images/

# If using Docker on Linux, you might need to adjust ownership
sudo chown -R 1000:1000 data/ logs/ maps/ scenes/ sounds/ campaign_images/
```

## Migration from Docker Volumes

If you're migrating from the old Docker volume setup:

1. **Stop the containers**:
   ```bash
   docker-compose down
   ```

2. **Export data from old volumes**:
   ```bash
   docker run --rm -v spelltable-data:/data -v $(pwd):/backup alpine tar -czf /backup/data-backup.tar.gz -C /data .
   ```

3. **Run the setup script**:
   ```bash
   ./setup-volumes.sh
   ```

4. **Extract data to new directories**:
   ```bash
   tar -xzf data-backup.tar.gz -C data/
   ```

5. **Start with new configuration**:
   ```bash
   docker-compose up -d
   ```

## Security Considerations

- The data directories contain user-uploaded content
- Ensure proper file permissions to prevent unauthorized access
- Consider encrypting sensitive data if needed
- Regular backups are recommended for production deployments

## Performance Notes

- Local volumes provide better I/O performance than Docker volumes
- For high-traffic deployments, consider using SSD storage
- Monitor disk space usage, especially for user uploads
