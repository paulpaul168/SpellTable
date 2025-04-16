"""
This module contains the websocket routes for the FastAPI app.
"""

import asyncio
import json
import os
from typing import Any, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
from starlette.websockets import WebSocketState

from ..core.constants import SCENES_DIR

router = APIRouter()

# Store connected clients
clients: Set[WebSocket] = set()
# Lock for thread-safe operations
clients_lock = asyncio.Lock()


async def broadcast_scene_update(scene_data: dict[str, Any]) -> None:
    """Broadcast scene update to all connected clients"""
    message = {"type": "scene_update", "scene": scene_data}
    async with clients_lock:
        disconnected_clients = set()
        for client in clients:
            try:
                await client.send_json(message)
            except (WebSocketDisconnect, RuntimeError, ConnectionError) as e:
                logger.exception(f"Error broadcasting to client: {e}")
                disconnected_clients.add(client)

        # Remove disconnected clients
        clients.difference_update(disconnected_clients)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for the FastAPI app.
    """
    try:
        # Accept the WebSocket connection
        await websocket.accept()
        async with clients_lock:
            clients.add(websocket)

        # Send initial connection success message
        await websocket.send_json({"type": "connection_status", "status": "connected"})

        # Send current scene if it exists
        try:
            scene_file = os.path.join(SCENES_DIR, "current_scene.json")
            if os.path.exists(scene_file):
                with open(file=scene_file, mode="r", encoding="utf-8") as f:
                    scene_data = json.load(f)
                    await websocket.send_json({"type": "scene_update", "scene": scene_data})
        except (OSError, json.JSONDecodeError) as e:
            logger.exception(f"Error sending initial scene: {e}")

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                logger.debug(f"Received message: {message}")

                if message.get("type") == "scene_update":
                    # Save the scene update
                    scene_data = message.get("scene", {})
                    try:
                        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
                        os.makedirs(os.path.dirname(scene_file), exist_ok=True)
                        with open(file=scene_file, mode="w", encoding="utf-8") as f:
                            json.dump(scene_data, f)
                    except (OSError, json.JSONDecodeError) as e:
                        logger.exception(f"Error saving scene: {e}")

                    # Broadcast the scene update to all connected clients
                    await broadcast_scene_update(scene_data)
            except WebSocketDisconnect:
                break
            except (json.JSONDecodeError, ConnectionError) as e:
                logger.exception(f"Error handling message: {e}")
                break

    except (WebSocketDisconnect, ConnectionError, RuntimeError) as e:
        logger.exception(f"WebSocket error: {e}")
    finally:
        async with clients_lock:
            clients.discard(websocket)
        try:
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close()
        except (WebSocketDisconnect, RuntimeError, ConnectionError):
            pass
