# SpellTable Docker Setup

This README provides instructions for running the SpellTable application using Docker Compose.

## Prerequisites

- Docker Engine (20.10.0+)
- Docker Compose (v2+)

## Getting Started

To start the application in production mode:

```bash
docker compose up -d
```

This will:
1. Build the backend and frontend Docker images
2. Start both services
3. Make the frontend available at http://localhost:3000
4. Make the backend available at http://localhost:8010

## Service Information

### Backend
- Python FastAPI application running on port 8010
- Health check endpoint: http://localhost:8010/health

### Frontend
- Next.js application running on port 3000
- Automatically configured to connect to the backend

## Managing the Application

### View logs
```bash
# All services
docker compose logs

# Specific service
docker compose logs backend
docker compose logs frontend
```

### Restart services
```bash
docker compose restart
```

### Stop services
```bash
docker compose down
```

### Rebuild images
```bash
docker compose build
```

## Data Persistence

By default, all data is stored within the Docker containers. To persist data between container restarts, consider adding volumes to the docker-compose.yml file.

## Environment Variables

You can customize the application behavior by modifying the environment variables in the docker-compose.yml file.

## Troubleshooting

If the frontend can't connect to the backend, check:
1. Both services are running: `docker compose ps`
2. Backend health check is passing: `curl http://localhost:8010/health`
3. Network configuration in docker-compose.yml is correct 