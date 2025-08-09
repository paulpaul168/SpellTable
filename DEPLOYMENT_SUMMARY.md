# SpellTable Deployment Summary

## Overview

SpellTable is a web-based virtual tabletop application with real-time collaboration features. This document provides a comprehensive guide for deploying SpellTable in various environments.

## Architecture

SpellTable consists of:
- **Frontend**: Next.js React application
- **Backend**: FastAPI Python application
- **Database**: SQLite (embedded)
- **Real-time**: WebSocket connections
- **Proxy**: Apache/Nginx for SSL termination and routing

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git
- Apache (for production proxy setup)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd SpellTable
./setup-volumes.sh  # Create local volume directories
```

### 2. Start Application
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8010

## Data Persistence

SpellTable now uses **local path volumes** for data persistence:

```
SpellTable/
├── data/              # Database and application data
├── logs/              # Application logs  
├── maps/              # Map files
├── scenes/            # Scene files
├── sounds/            # Audio files
└── campaign_images/   # Campaign images
```

**Benefits:**
- ✅ Data survives container restarts
- ✅ Easy backup and restore
- ✅ Transparent data storage
- ✅ Better performance than Docker volumes

## Environment Configurations

### Development Environment
- **File**: `docker-compose.yml`
- **Features**: 
  - Hot reloading
  - Debug logging
  - Direct port access
  - Local volume mounts

### Production Environment  
- **File**: `docker-compose.prod.yml`
- **Features**:
  - Optimized builds
  - Health checks
  - Local volume mounts
  - Production logging

## Proxy Configuration

### Apache Proxy Setup
For production deployments, use Apache as a reverse proxy:

```apache
# Backend API routes
ProxyPass        /api/  http://localhost:8010/
ProxyPassReverse /api/  http://localhost:8010/

# Frontend routes  
ProxyPass        /       http://localhost:3000/
ProxyPassReverse /       http://localhost:3000/
```

### SSL Configuration
- Use Let's Encrypt for SSL certificates
- Configure automatic redirects from HTTP to HTTPS
- Set appropriate security headers

## Backup and Restore

### Manual Backup
```bash
# Create backup archive
tar -czf spelltable-backup-$(date +%Y%m%d).tar.gz \
  data/ maps/ scenes/ sounds/ campaign_images/

# Restore from backup
tar -xzf spelltable-backup-20231201.tar.gz
```

### Built-in Backup System
SpellTable includes a comprehensive backup system accessible via the web interface:
- Export/import maps, scenes, audio
- Campaign data and diary content
- User accounts with passwords
- Selective backup options

## Monitoring and Logs

### Application Logs
- Location: `./logs/`
- Format: Structured JSON logs
- Rotation: Automatic log rotation

### Health Checks
- Backend: `GET /health`
- Frontend: Built-in health monitoring
- Docker: Container health checks

## Security Considerations

### Data Protection
- User passwords are hashed and included in backups
- File uploads are validated and sanitized
- API endpoints require authentication
- CORS policies are properly configured

### Network Security
- No direct container exposure in production
- All traffic routed through Apache proxy
- SSL/TLS encryption for all connections
- Proper firewall configuration recommended

## Performance Optimization

### Storage
- Use SSD storage for better I/O performance
- Monitor disk space usage
- Implement log rotation

### Network
- Configure proper caching headers
- Use gzip compression
- Optimize image delivery

### Application
- Database connection pooling
- Efficient file handling
- Memory usage monitoring

## Troubleshooting

### Common Issues

1. **Permission Errors**
   ```bash
   chmod 755 data/ logs/ maps/ scenes/ sounds/ campaign_images/
   ```

2. **Container Won't Start**
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

3. **Data Not Persisting**
   - Verify volume mounts in docker-compose.yml
   - Check directory permissions
   - Ensure directories exist

4. **API Connection Issues**
   - Verify NEXT_PUBLIC_API_URL setting
   - Check proxy configuration
   - Test backend health endpoint

### Debug Commands
```bash
# View logs
docker-compose logs -f

# Check container status
docker-compose ps

# Access container shell
docker-compose exec backend bash

# Test API connectivity
curl http://localhost:8010/health
```

## Migration Guide

### From Docker Volumes to Local Volumes
1. Stop containers: `docker-compose down`
2. Export data: `docker run --rm -v spelltable-data:/data -v $(pwd):/backup alpine tar -czf /backup/data-backup.tar.gz -C /data .`
3. Run setup: `./setup-volumes.sh`
4. Restore data: `tar -xzf data-backup.tar.gz -C data/`
5. Start with new config: `docker-compose up -d`

## Support and Maintenance

### Regular Maintenance
- Monitor disk space usage
- Review application logs
- Update dependencies regularly
- Test backup/restore procedures

### Updates
1. Pull latest code: `git pull`
2. Rebuild containers: `docker-compose build`
3. Restart services: `docker-compose up -d`
4. Verify functionality

### Backup Schedule
- Daily: Automated backups (recommended)
- Weekly: Manual backup verification
- Monthly: Full system backup test

## Conclusion

SpellTable provides a robust, scalable solution for virtual tabletop gaming with comprehensive data persistence, backup capabilities, and deployment flexibility. The local volume setup ensures data safety while maintaining performance and ease of management.
