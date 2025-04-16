# SpellTable Backend Architecture

## Overview

The SpellTable backend is built with FastAPI, a modern Python web framework for building APIs. The backend serves as the central hub for managing game assets (maps, scenes, audio) and providing real-time communication between clients.

## Flowchart

![Flowchart](./backend_flow.drawio.svg)

## Key Components

### 1. Main Application (main.py)

The entry point that:

- Creates the FastAPI application
- Configures middleware (CORS)
- Includes routers for different API endpoints
- Sets up WebSocket functionality
- Starts the Uvicorn server

### 2. Core Configuration (app/core/config.py)

Handles:

- FastAPI app creation and configuration
- WebSocket connection management
- CORS configuration for frontend access

### 3. API Routes

The backend is organized into several route modules:

#### websocket.py

- Manages real-time communication between clients
- Handles WebSocket connections, disconnections, and broadcasting
- Shares scene updates in real-time between connected clients

#### scenes.py

- CRUD operations for game scenes
- Folder management for organizing scenes
- Image management for scene assets
- Endpoints:
  - `/scenes/save` - Save a scene
  - `/scenes/list` - List available scenes
  - `/scenes/load/{scene_id}` - Load a specific scene
  - `/scenes/{scene_id}` - Update or delete a scene
  - `/scenes/folder` - Create/manage folders
  - `/scenes/{scene_id}/image` - Upload/manage scene images

#### maps.py

- Map file management
- Folder organization for maps
- Endpoints:
  - `/maps/list` - List available maps
  - `/maps/folders` - List map folders
  - `/maps/upload` - Upload map images
  - `/maps/file/{path}` - Retrieve map files
  - `/maps/rename/{file_name}` - Rename maps
  - `/maps/move/{file_name}` - Move maps between folders
  - `/maps/data` - Store and retrieve map metadata

#### audio.py

- Audio file management for game sounds
- Audio playback control

### 4. Data Models (app/models)

Pydantic models for data validation and structure:

- `MapData` - Map information and settings
- `SceneData` - Scene structure and properties
- `SceneImage` - Image information for scenes
- `FolderItem` - Directory structure representation

### 5. File Storage

The backend uses the local file system to store:

- **Maps Directory** - Image files for maps (.png, .jpg, etc.)
- **Scenes Directory** - JSON files containing scene data
- **Sounds Directory** - Audio files (.mp3, .ogg, etc.)

## Data Flow

1. **HTTP API Requests**:
   - Frontend makes HTTP requests to the various API endpoints
   - Backend processes requests and interacts with the file system
   - Responses are sent back to the client

2. **WebSocket Communication**:
   - Real-time updates are broadcast via WebSockets
   - Scene changes from one client are propagated to all connected clients
   - Connection management handles client connect/disconnect events

## Technology Stack

- **FastAPI** - Modern, fast web framework for building APIs
- **Uvicorn** - ASGI server for running the FastAPI application
- **Pydantic** - Data validation and settings management
- **WebSockets** - Real-time communication protocol

## Deployment

The application is designed to run as a self-contained service on port 8010, accessible to frontend clients through a combination of REST API endpoints and WebSocket connections.
