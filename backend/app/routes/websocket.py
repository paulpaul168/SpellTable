"""
This module contains the websocket routes for the FastAPI app.
"""

import asyncio
import json
import os
from typing import Any, Dict, Set

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
    await _broadcast_to_all_clients(message)


async def _broadcast_to_all_clients(message: Dict[str, Any]) -> None:
    """Broadcast a message to all connected clients."""
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


async def _broadcast_to_others(websocket: WebSocket, message: Dict[str, Any]) -> None:
    """Broadcast a message to all clients except the sender."""
    async with clients_lock:
        disconnected_clients = set()
        for client in clients:
            if client != websocket:  # Don't send back to the sender
                try:
                    await client.send_json(message)
                except (WebSocketDisconnect, RuntimeError, ConnectionError) as e:
                    logger.exception(f"Error broadcasting to client: {e}")
                    disconnected_clients.add(client)

        # Remove disconnected clients
        clients.difference_update(disconnected_clients)


async def _send_initial_scene(websocket: WebSocket) -> None:
    """Send the current scene to a newly connected client."""
    try:
        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
        if os.path.exists(scene_file):
            with open(file=scene_file, mode="r", encoding="utf-8") as f:
                scene_data = json.load(f)
                await websocket.send_json({"type": "scene_update", "scene": scene_data})
    except (OSError, json.JSONDecodeError) as e:
        logger.exception(f"Error sending initial scene: {e}")


async def _save_scene_data(scene_data: Dict[str, Any]) -> None:
    """Save scene data to file."""
    try:
        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
        os.makedirs(os.path.dirname(scene_file), exist_ok=True)
        with open(file=scene_file, mode="w", encoding="utf-8") as f:
            json.dump(scene_data, f)
    except (OSError, json.JSONDecodeError) as e:
        logger.exception(f"Error saving scene: {e}")


async def _handle_scene_update(message: Dict[str, Any]) -> None:
    """Handle scene update messages."""
    scene_data = message.get("scene", {})
    await _save_scene_data(scene_data)
    await broadcast_scene_update(scene_data)


async def _handle_highlight_marker(websocket: WebSocket, message: Dict[str, Any]) -> None:
    """Handle highlight marker messages."""
    marker_id = message.get("markerId")
    if marker_id:
        highlight_message = {"type": "highlight_marker", "markerId": marker_id}
        await _broadcast_to_others(websocket, highlight_message)


async def _handle_blank_viewer(websocket: WebSocket, message: Dict[str, Any]) -> None:
    """Handle blank viewer messages."""
    blank_message = {"type": "blank_viewer", "isBlank": True}
    await _broadcast_to_others(websocket, blank_message)


async def _handle_unblank_viewer(websocket: WebSocket, message: Dict[str, Any]) -> None:
    """Handle unblank viewer messages."""
    unblank_message = {"type": "unblank_viewer", "isBlank": False}
    await _broadcast_to_others(websocket, unblank_message)


async def _handle_rotate_viewer(websocket: WebSocket, message: Dict[str, Any]) -> None:
    """Handle rotate viewer messages."""
    rotate_message = {"type": "rotate_viewer", "isRotated": True}
    await _broadcast_to_others(websocket, rotate_message)


async def _handle_unrotate_viewer(websocket: WebSocket, message: Dict[str, Any]) -> None:
    """Handle unrotate viewer messages."""
    unrotate_message = {"type": "unrotate_viewer", "isRotated": False}
    await _broadcast_to_others(websocket, unrotate_message)


async def _handle_websocket_message(websocket: WebSocket, data: str) -> bool:
    """
    Handle a single websocket message.

    Returns:
        bool: True to continue processing, False to break the loop
    """
    try:
        message = json.loads(data)
        logger.debug(f"Received message: {message}")

        message_type = message.get("type")
        if message_type == "scene_update":
            await _handle_scene_update(message)
        elif message_type == "highlight_marker":
            await _handle_highlight_marker(websocket, message)
        elif message_type == "blank_viewer":
            await _handle_blank_viewer(websocket, message)
        elif message_type == "unblank_viewer":
            await _handle_unblank_viewer(websocket, message)
        elif message_type == "rotate_viewer":
            await _handle_rotate_viewer(websocket, message)
        elif message_type == "unrotate_viewer":
            await _handle_unrotate_viewer(websocket, message)

        return True

    except (json.JSONDecodeError, ConnectionError) as e:
        logger.exception(f"Error handling message: {e}")
        return False


async def _cleanup_websocket(websocket: WebSocket) -> None:
    """Clean up websocket connection."""
    async with clients_lock:
        clients.discard(websocket)
    try:
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close()
    except (WebSocketDisconnect, RuntimeError, ConnectionError):
        pass


async def _setup_websocket_connection(websocket: WebSocket) -> None:
    """Set up a new websocket connection."""
    # Accept the WebSocket connection
    await websocket.accept()
    async with clients_lock:
        clients.add(websocket)

    # Send initial connection success message
    await websocket.send_json({"type": "connection_status", "status": "connected"})

    # Send current scene if it exists
    await _send_initial_scene(websocket)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for the FastAPI app.
    """
    try:
        await _setup_websocket_connection(websocket)

        # Main message processing loop
        while True:
            try:
                data = await websocket.receive_text()
                should_continue = await _handle_websocket_message(websocket, data)
                if not should_continue:
                    break
            except WebSocketDisconnect:
                # Client disconnected, exit the loop normally
                break
            except (json.JSONDecodeError, ConnectionError) as e:
                logger.exception(f"Error in message loop: {e}")
                break

    except (WebSocketDisconnect, ConnectionError, RuntimeError) as e:
        logger.debug(
            f"WebSocket disconnected: {e}"
        )  # Changed to debug level for normal disconnects
    finally:
        await _cleanup_websocket(websocket)
