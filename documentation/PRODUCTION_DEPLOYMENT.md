# SpellTable Production Deployment Guide

This guide provides step-by-step instructions for deploying SpellTable in a production environment.

## Architecture Overview

```
Internet
    ↓
[Nginx Reverse Proxy] (SSL Termination, Load Balancing)
    ↓
[Frontend Container] (Next.js - Port 3000)
    ↓ (Internal Docker Network)
[Backend Container] (FastAPI - Port 8010, Internal Only)
```

## Prerequisites

- Docker Engine 20.10.0+
- Docker Compose v2+
- Domain name (optional but recommended)
- SSL certificates (for HTTPS)
- Server with at least 2GB RAM and 10GB storage

## Deployment Options

### Option 1: Simple Docker Compose (Development/Staging)

This is the simplest deployment option, suitable for development or staging environments:

```bash
# Clone the repository
git clone <repository-url>
cd SpellTable

# Deploy using the provided script
./deploy.sh deploy

# Or manually
docker compose up -d --build
```

**Access:**
- Frontend: http://your-server-ip:3000
- Backend: Internal only (not exposed)

### Option 2: Production with Nginx Reverse Proxy

For production environments, we recommend using Nginx as a reverse proxy:

1. **Create production docker-compose file:**

```bash
# Use the production configuration
./deploy.sh deploy docker-compose.prod.yml
```

2. **Set up Nginx reverse proxy:**

```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Copy the nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/spelltable

# Enable the site
sudo ln -s /etc/nginx/sites-available/spelltable /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

3. **Configure SSL (Let's Encrypt):**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add this line: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 3: Docker Swarm (High Availability)

For high-availability deployments:

```bash
# Initialize Docker Swarm
docker swarm init

# Deploy the stack
docker stack deploy -c docker-compose.prod.yml spelltable
```

## Environment Configuration

### Frontend Environment Variables

Create `frontend/.env.production`:

```env
# Backend API URL (internal Docker network)
NEXT_PUBLIC_API_URL=http://backend:8010

# Optional: Analytics, monitoring, etc.
NEXT_PUBLIC_GA_ID=your-google-analytics-id
```

### Backend Environment Variables

Create `backend/.env`:

```env
# Database configuration (if using external database)
DATABASE_URL=sqlite:///./spelltable.db

# Security settings
SECRET_KEY=your-secret-key-here
DEBUG=false

# Logging
LOG_LEVEL=INFO
```

## Data Persistence

The production configuration includes volumes for data persistence:

- `spelltable-data`: Application data
- `spelltable-logs`: Application logs
- `spelltable-maps`: Map files
- `spelltable-scenes`: Scene files
- `spelltable-sounds`: Audio files
- `spelltable-campaign-images`: Campaign images

### Backup Strategy

1. **Automated backups:**

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup all volumes
docker run --rm \
  -v spelltable-data:/data \
  -v spelltable-maps:/maps \
  -v spelltable-scenes:/scenes \
  -v spelltable-sounds:/sounds \
  -v spelltable-campaign-images:/campaign-images \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/spelltable-backup-$DATE.tar.gz \
  -C /data . \
  -C /maps . \
  -C /scenes . \
  -C /sounds . \
  -C /campaign-images .
EOF

chmod +x backup.sh

# Add to crontab (daily backup at 2 AM)
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

2. **Manual backups:**

```bash
# Stop the application
docker compose -f docker-compose.prod.yml down

# Backup volumes
docker run --rm -v spelltable-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/spelltable-data-$(date +%Y%m%d).tar.gz -C /data .

# Restart the application
docker compose -f docker-compose.prod.yml up -d
```

## Monitoring and Logging

### Application Monitoring

1. **Health checks:**

```bash
# Check application health
curl http://localhost:3000/ # Frontend
curl http://localhost:8010/health # Backend (internal)

# Docker health checks
docker compose -f docker-compose.prod.yml ps
```

2. **Log monitoring:**

```bash
# View application logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f backend
```

### System Monitoring

Consider using monitoring tools like:
- **Prometheus + Grafana**: For metrics and visualization
- **ELK Stack**: For log aggregation and analysis
- **Datadog**: For comprehensive monitoring

## Security Considerations

### Container Security

1. **Non-root users:**
   - Both frontend and backend containers should run as non-root users
   - Update Dockerfiles if needed

2. **Image scanning:**
   ```bash
   # Scan images for vulnerabilities
   docker scan spelltable-frontend
   docker scan spelltable-backend
   ```

3. **Secrets management:**
   - Use Docker secrets or external secret management
   - Never commit secrets to version control

### Network Security

1. **Firewall configuration:**
   ```bash
   # Allow only necessary ports
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw allow 22/tcp   # SSH
   sudo ufw enable
   ```

2. **Network isolation:**
   - Backend is not exposed to external network
   - Only frontend is accessible through reverse proxy

## Performance Optimization

### Frontend Optimization

1. **CDN configuration:**
   - Use a CDN for static assets
   - Configure caching headers

2. **Image optimization:**
   - Optimize images before upload
   - Use WebP format when possible

### Backend Optimization

1. **Database optimization:**
   - Use connection pooling
   - Implement proper indexing

2. **Caching:**
   - Implement Redis for session storage
   - Use cache headers for static content

## Troubleshooting

### Common Issues

1. **Frontend can't connect to backend:**
   ```bash
   # Check if backend is running
   docker compose -f docker-compose.prod.yml ps

   # Check backend logs
   docker compose -f docker-compose.prod.yml logs backend

   # Test internal connectivity
   docker compose -f docker-compose.prod.yml exec frontend ping backend
   ```

2. **High memory usage:**
   ```bash
   # Check resource usage
   docker stats

   # Restart containers
   docker compose -f docker-compose.prod.yml restart
   ```

3. **Disk space issues:**
   ```bash
   # Clean up unused data
   docker system prune -f

   # Check volume usage
   docker system df -v
   ```

### Log Analysis

```bash
# Search for errors
docker compose -f docker-compose.prod.yml logs | grep -i error

# Search for specific patterns
docker compose -f docker-compose.prod.yml logs | grep "pattern"
```

## Maintenance

### Regular Maintenance Tasks

1. **Update dependencies:**
   ```bash
   # Pull latest changes
   git pull

   # Rebuild images
   docker compose -f docker-compose.prod.yml build --no-cache

   # Deploy updates
   docker compose -f docker-compose.prod.yml up -d
   ```

2. **Clean up old data:**
   ```bash
   # Remove old backups (keep last 30 days)
   find /backups -name "spelltable-backup-*.tar.gz" -mtime +30 -delete
   ```

3. **Monitor disk usage:**
   ```bash
   # Check disk usage
   df -h

   # Check Docker usage
   docker system df
   ```

## Support

For deployment issues:
1. Check the logs: `docker compose -f docker-compose.prod.yml logs`
2. Verify configuration files
3. Test connectivity between containers
4. Check system resources

For application issues:
1. Review application logs
2. Check database connectivity
3. Verify environment variables
4. Test API endpoints
