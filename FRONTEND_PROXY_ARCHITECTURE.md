# Frontend Proxy Architecture

## Overview

The frontend now acts as a proxy for all backend communication. The browser never connects directly to the backend - all requests go through the frontend first.

## Architecture

```
Browser → Frontend (Port 3000) → Backend (Port 8010, Internal Only)
```

### HTTP API Requests
- **Browser**: `GET /api/auth/login` → Frontend
- **Frontend**: Proxies to `http://backend:8010/auth/login`
- **Backend**: Processes request and returns response
- **Frontend**: Returns response to browser

### WebSocket Connections
- **Browser**: `ws://localhost:3000/api/ws` → Frontend
- **Frontend**: Proxies to `ws://backend:8010/ws`
- **Backend**: Handles WebSocket communication
- **Frontend**: Forwards messages between browser and backend

## Benefits

1. **Security**: Backend is completely isolated from external access
2. **No Mixed Content**: All communication uses the same protocol
3. **Simplified CORS**: No CORS issues since everything goes through frontend
4. **Better Control**: Frontend can add authentication, logging, rate limiting
5. **Easier Deployment**: Only frontend needs to be exposed

## Implementation

### Custom Server (`server.js`)
- Handles HTTP API proxying
- Handles WebSocket proxying
- Routes all `/api/*` requests to backend
- Routes all other requests to Next.js

### Frontend Services
- All services now use `/api` as the base URL
- No direct backend URLs in frontend code
- WebSocket connects to `/api/ws`

### Environment Variables
- `BACKEND_URL`: Internal backend URL (for frontend server)
- `NEXT_PUBLIC_API_URL`: Removed (no longer needed)

## File Changes

### New Files
- `frontend/server.js`: Custom server for proxying
- `frontend/package.json`: Added `ws` dependency

### Updated Files
- `frontend/Dockerfile`: Uses custom server
- `docker-compose.yml`: Added `BACKEND_URL` environment
- `frontend/src/services/*.ts`: Updated to use `/api` routes
- `frontend/src/services/websocket.ts`: Updated to use `/api/ws`

### Removed Files
- `frontend/src/app/api/[...path]/route.ts`: No longer needed
- `frontend/src/app/api/ws/route.ts`: No longer needed

## Deployment

### Development
```bash
# Start with proxy
docker compose up -d --build
```

### Production
```bash
# Start with proxy and volumes
docker compose -f docker-compose.prod.yml up -d --build
```

## Testing

1. **API Requests**: All API calls go through `/api/*`
2. **WebSocket**: Connects to `ws://localhost:3000/api/ws`
3. **No Direct Backend Access**: Backend is completely internal

## Troubleshooting

### WebSocket Connection Issues
- Check that `ws` package is installed
- Verify custom server is running
- Check backend WebSocket endpoint is working

### API Request Issues
- Verify `BACKEND_URL` environment variable is set
- Check backend is accessible from frontend container
- Review custom server logs

### Build Issues
- Ensure `ws` dependency is in `package.json`
- Verify custom server file is copied in Dockerfile
- Check Node.js version compatibility
