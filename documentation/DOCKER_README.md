# SpellTable Docker Deployment

This README provides instructions for deploying the SpellTable application using Docker Compose.

## Architecture

The application is deployed with the following architecture:
- **Frontend**: Next.js application accessible from outside the container (port 3000)
- **Backend**: FastAPI application only accessible internally through Docker networking
- **Network**: Isolated Docker network for secure internal communication

## Prerequisites

- Docker Engine (20.10.0+)
- Docker Compose (v2+)

## Deployment

### Quick Start

To deploy the application:

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f
```

### Production Deployment

For production deployment, it's recommended to:

1. **Set up a reverse proxy** (nginx, Traefik, etc.) in front of the frontend container
2. **Configure SSL/TLS** certificates
3. **Set up proper logging** and monitoring
4. **Use external volumes** for data persistence

Example production docker-compose.yml with volumes:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ../backend
      dockerfile: ../backend/Dockerfile
    expose:
      - "8010"
    environment:
      - PYTHONUNBUFFERED=1
    restart: unless-stopped
    volumes:
      - spelltable-data:/app/data
      - spelltable-logs:/app/logs
    healthcheck:
      test: [ "CMD", "curl", "-f", "http://localhost:8010/health" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - spelltable-network

  frontend:
    build:
      context: ../frontend
      dockerfile: ../frontend/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8010
    networks:
      - spelltable-network

volumes:
  spelltable-data:
  spelltable-logs:

networks:
  spelltable-network:
    driver: bridge
```

## Service Information

### Frontend (Public)
- **URL**: http://localhost:3000 (or your server's IP/domain)
- **Access**: Publicly accessible
- **Purpose**: User interface for the SpellTable application

### Backend (Internal)
- **URL**: http://backend:8010 (internal Docker network only)
- **Access**: Only accessible from within the Docker network
- **Purpose**: API server for the application

## Security Features

1. **Isolated Backend**: The backend service is not exposed to the internet
2. **Internal Communication**: Frontend and backend communicate through Docker's internal network
3. **Container Isolation**: Each service runs in its own container

## Managing the Application

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Restart services
```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart frontend
docker compose restart backend
```

### Stop services
```bash
docker compose down
```

### Rebuild and redeploy
```bash
# Rebuild all images
docker compose build

# Rebuild specific service
docker compose build backend
docker compose build frontend

# Redeploy with new images
docker compose up -d
```

### Update application
```bash
# Pull latest changes and rebuild
git pull
docker compose build
docker compose up -d
```

## Data Persistence

By default, all data is stored within the Docker containers. For production deployments, you should add volumes:

```yaml
volumes:
  - spelltable-data:/app/data
  - spelltable-logs:/app/logs
  - spelltable-maps:/app/maps
  - spelltable-scenes:/app/scenes
  - spelltable-sounds:/app/sounds
```

## Environment Variables

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://backend:8010)

### Backend
- `PYTHONUNBUFFERED`: Python output unbuffered (default: 1)

## Troubleshooting

### Frontend can't connect to backend
1. Check if both services are running: `docker compose ps`
2. Verify backend health: `docker compose exec backend curl http://localhost:8010/health`
3. Check network connectivity: `docker compose exec frontend ping backend`
4. Review logs: `docker compose logs backend frontend`

### Service won't start
1. Check port conflicts: `docker compose ps`
2. Review service logs: `docker compose logs <service-name>`
3. Verify Docker resources (memory, disk space)

### Data persistence issues
1. Ensure volumes are properly configured
2. Check volume permissions
3. Verify volume mounts in `docker compose ps`

## Monitoring

### Health Checks
- Backend health endpoint: `http://backend:8010/health` (internal)
- Frontend: Check if port 3000 is responding

### Logging
- Application logs: `docker compose logs -f`
- System logs: `journalctl -u docker.service` (if using systemd)

## Backup and Recovery

### Backup
```bash
# Backup data volumes
docker run --rm -v spelltable-data:/data -v $(pwd):/backup alpine tar czf /backup/spelltable-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Recovery
```bash
# Restore from backup
docker run --rm -v spelltable-data:/data -v $(pwd):/backup alpine tar xzf /backup/spelltable-backup-20231201.tar.gz -C /data
``` 