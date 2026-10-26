"""
This module contains the websocket routes for the FastAPI app.
"""

import asyncio
import json
import os
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
from starlette.websockets import WebSocketState

from ..core.constants import SCENES_DIR

router = APIRouter()

# Store connected clients by id
clients: dict[str, WebSocket] = {}
# Reverse lookup for cleanup
_client_ids: dict[WebSocket, str] = {}
# Lock for thread-safe operations
clients_lock = asyncio.Lock()
# Active screen-share publisher (WebSocket client id)
active_sharer_id: str | None = None
# Debounced scene persistence
_pending_scene_save: dict[str, Any] | None = None
_scene_save_task: asyncio.Task[None] | None = None
SCENE_SAVE_DEBOUNCE_SEC = 1.0

SCREEN_SHARE_UNICAST_TYPES = frozenset(
    {
        "screen_share_request",
        "screen_share_offer",
        "screen_share_answer",
        "screen_share_ice",
    }
)


async def broadcast_scene_update(scene_data: dict[str, Any]) -> None:
    """Broadcast scene update to all connected clients"""
    message = {"type": "scene_update", "scene": scene_data}
    await _broadcast_to_all_clients(message)


async def _broadcast_to_all_clients(message: dict[str, Any]) -> None:
    """Broadcast a message to all connected clients."""
    async with clients_lock:
        disconnected_ids: list[str] = []
        for client_id, client in clients.items():
            try:
                await client.send_json(message)
            except (WebSocketDisconnect, RuntimeError, ConnectionError) as e:
                logger.exception(f"Error broadcasting to client: {e}")
                disconnected_ids.append(client_id)

        for client_id in disconnected_ids:
            _remove_client_locked(client_id)


async def _broadcast_to_others(websocket: WebSocket, message: dict[str, Any]) -> None:
    """Broadcast a message to all clients except the sender."""
    async with clients_lock:
        disconnected_ids: list[str] = []
        for client_id, client in clients.items():
            if client != websocket:
                try:
                    await client.send_json(message)
                except (WebSocketDisconnect, RuntimeError, ConnectionError) as e:
                    logger.exception(f"Error broadcasting to client: {e}")
                    disconnected_ids.append(client_id)

        for client_id in disconnected_ids:
            _remove_client_locked(client_id)


def _remove_client_locked(client_id: str) -> None:
    """Remove a client from registries. Caller must hold clients_lock."""
    websocket = clients.pop(client_id, None)
    if websocket is not None:
        _client_ids.pop(websocket, None)


async def _send_to_client(target_client_id: str, message: dict[str, Any]) -> None:
    """Unicast a message to a specific client id."""
    async with clients_lock:
        client = clients.get(target_client_id)
        if client is None:
            logger.debug(f"Target client {target_client_id} not connected")
            return
        try:
            await client.send_json(message)
        except (WebSocketDisconnect, RuntimeError, ConnectionError) as e:
            logger.exception(f"Error sending to client {target_client_id}: {e}")
            _remove_client_locked(target_client_id)


async def _send_initial_scene(websocket: WebSocket) -> None:
    """Send the current scene to a newly connected client."""
    try:
        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
        if os.path.exists(scene_file):
            with open(file=scene_file, encoding="utf-8") as f:
                scene_data = json.load(f)
                await websocket.send_json({"type": "scene_update", "scene": scene_data})
    except (OSError, json.JSONDecodeError) as e:
        logger.exception(f"Error sending initial scene: {e}")


async def _save_scene_data(scene_data: dict[str, Any]) -> None:
    """Save scene data to file."""
    try:
        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
        os.makedirs(os.path.dirname(scene_file), exist_ok=True)
        with open(file=scene_file, mode="w", encoding="utf-8") as f:
            json.dump(scene_data, f)
    except (OSError, json.JSONDecodeError) as e:
        logger.exception(f"Error saving scene: {e}")


async def _schedule_scene_save(scene_data: dict[str, Any]) -> None:
    """Persist scene to disk after a quiet period to avoid write storms during drag."""
    global _pending_scene_save, _scene_save_task
    _pending_scene_save = scene_data
    if _scene_save_task and not _scene_save_task.done():
        _scene_save_task.cancel()
        try:
            await _scene_save_task
        except asyncio.CancelledError:
            pass

    async def _debounced_save() -> None:
        await asyncio.sleep(SCENE_SAVE_DEBOUNCE_SEC)
        if _pending_scene_save is not None:
            await _save_scene_data(_pending_scene_save)

    _scene_save_task = asyncio.create_task(_debounced_save())


async def _handle_scene_update(websocket: WebSocket, message: dict[str, Any]) -> None:
    """Handle scene update messages."""
    scene_data = message.get("scene", {})
    await _schedule_scene_save(scene_data)
    await _broadcast_to_others(websocket, {"type": "scene_update", "scene": scene_data})


async def _handle_highlight_marker(
    websocket: WebSocket, message: dict[str, Any]
) -> None:
    """Handle highlight marker messages."""
    marker_id = message.get("markerId")
    if marker_id:
        highlight_message = {"type": "highlight_marker", "markerId": marker_id}
        await _broadcast_to_others(websocket, highlight_message)


async def _handle_blank_viewer(websocket: WebSocket, _message: dict[str, Any]) -> None:
    """Handle blank viewer messages."""
    blank_message = {"type": "blank_viewer", "isBlank": True}
    await _broadcast_to_others(websocket, blank_message)


async def _handle_unblank_viewer(
    websocket: WebSocket, _message: dict[str, Any]
) -> None:
    """Handle unblank viewer messages."""
    unblank_message = {"type": "unblank_viewer", "isBlank": False}
    await _broadcast_to_others(websocket, unblank_message)


async def _handle_rotate_viewer(websocket: WebSocket, _message: dict[str, Any]) -> None:
    """Handle rotate viewer messages."""
    rotate_message = {"type": "rotate_viewer", "isRotated": True}
    await _broadcast_to_others(websocket, rotate_message)


async def _handle_unrotate_viewer(
    websocket: WebSocket, _message: dict[str, Any]
) -> None:
    """Handle unrotate viewer messages."""
    unrotate_message = {"type": "unrotate_viewer", "isRotated": False}
    await _broadcast_to_others(websocket, unrotate_message)


async def _handle_scene_event(websocket: WebSocket, message: dict[str, Any]) -> None:
    """Relay gameboard visual effects to other clients."""
    event_type = message.get("eventType")
    if not event_type:
        return
    payload: dict[str, Any] = {"type": "scene_event", "eventType": event_type}
    for key in ("x", "y", "enabled", "brightness", "points"):
        if key in message:
            payload[key] = message[key]
    await _broadcast_to_others(websocket, payload)


async def _handle_screen_share_started(
    websocket: WebSocket, from_client_id: str, _message: dict[str, Any]
) -> None:
    """Mark sharer active and notify other clients."""
    global active_sharer_id
    active_sharer_id = from_client_id
    await _broadcast_to_others(
        websocket,
        {
            "type": "screen_share_started",
            "fromClientId": from_client_id,
        },
    )


async def _handle_screen_share_stopped(
    websocket: WebSocket, from_client_id: str, _message: dict[str, Any]
) -> None:
    """Clear sharer and notify other clients."""
    global active_sharer_id
    if active_sharer_id == from_client_id:
        active_sharer_id = None
    await _broadcast_to_others(
        websocket,
        {
            "type": "screen_share_stopped",
            "fromClientId": from_client_id,
        },
    )


async def _handle_screen_share_unicast(
    from_client_id: str, message: dict[str, Any]
) -> None:
    """Relay WebRTC signaling to a specific peer."""
    target_client_id = message.get("targetClientId")
    if not isinstance(target_client_id, str) or not target_client_id:
        logger.debug("screen share unicast missing targetClientId")
        return

    payload = {**message, "fromClientId": from_client_id}
    # screen_share_request goes to active sharer when target omitted misuse —
    # callers must set target; for request without target, route to sharer.
    if message.get("type") == "screen_share_request" and active_sharer_id:
        if target_client_id != active_sharer_id:
            # Prefer explicit target; if client targeted wrong id, still try send
            pass
        await _send_to_client(target_client_id, payload)
        return

    await _send_to_client(target_client_id, payload)


async def _handle_websocket_message(
    websocket: WebSocket, from_client_id: str, data: str
) -> bool:
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
            await _handle_scene_update(websocket, message)
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
        elif message_type == "scene_event":
            await _handle_scene_event(websocket, message)
        elif message_type == "screen_share_started":
            await _handle_screen_share_started(websocket, from_client_id, message)
        elif message_type == "screen_share_stopped":
            await _handle_screen_share_stopped(websocket, from_client_id, message)
        elif message_type in SCREEN_SHARE_UNICAST_TYPES:
            # Requests without target route to the active sharer
            if (
                message_type == "screen_share_request"
                and not message.get("targetClientId")
                and active_sharer_id
            ):
                message = {**message, "targetClientId": active_sharer_id}
            await _handle_screen_share_unicast(from_client_id, message)

        return True

    except (json.JSONDecodeError, ConnectionError) as e:
        logger.exception(f"Error handling message: {e}")
        return False


async def _cleanup_websocket(websocket: WebSocket) -> None:
    """Clean up websocket connection."""
    global active_sharer_id
    stopped_share = False
    client_id: str | None = None

    async with clients_lock:
        client_id = _client_ids.get(websocket)
        if client_id is not None:
            if active_sharer_id == client_id:
                active_sharer_id = None
                stopped_share = True
            _remove_client_locked(client_id)

    if stopped_share and client_id is not None:
        await _broadcast_to_all_clients(
            {"type": "screen_share_stopped", "fromClientId": client_id}
        )

    try:
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close()
    except (WebSocketDisconnect, RuntimeError, ConnectionError):
        pass


async def _setup_websocket_connection(websocket: WebSocket) -> str:
    """Set up a new websocket connection and return its client id."""
    client_id = str(uuid.uuid4())
    await websocket.accept()
    async with clients_lock:
        clients[client_id] = websocket
        _client_ids[websocket] = client_id

    await websocket.send_json(
        {
            "type": "connection_status",
            "status": "connected",
            "clientId": client_id,
        }
    )

    await _send_initial_scene(websocket)

    if active_sharer_id and active_sharer_id != client_id:
        await websocket.send_json(
            {
                "type": "screen_share_started",
                "fromClientId": active_sharer_id,
            }
        )

    return client_id


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for the FastAPI app.
    """
    client_id: str | None = None
    try:
        client_id = await _setup_websocket_connection(websocket)

        while True:
            try:
                data = await websocket.receive_text()
                should_continue = await _handle_websocket_message(
                    websocket, client_id, data
                )
                if not should_continue:
                    break
            except WebSocketDisconnect:
                break
            except (json.JSONDecodeError, ConnectionError) as e:
                logger.exception(f"Error in message loop: {e}")
                break

    except (WebSocketDisconnect, ConnectionError, RuntimeError) as e:
        logger.debug(f"WebSocket disconnected: {e}")
    finally:
        await _cleanup_websocket(websocket)
