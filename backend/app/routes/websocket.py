from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any, Set
import json
import os
import asyncio
from ..core.constants import SCENES_DIR

router = APIRouter()

# Store connected clients
clients: Set[WebSocket] = set()
# Lock for thread-safe operations
clients_lock = asyncio.Lock()


async def broadcast_scene_update(scene_data: Dict[str, Any]):
    """Broadcast scene update to all connected clients"""
    message = {"type": "scene_update", "scene": scene_data}
    async with clients_lock:
        disconnected_clients = set()
        for client in clients:
            try:
                await client.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")
                disconnected_clients.add(client)

        # Remove disconnected clients
        clients.difference_update(disconnected_clients)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
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
                with open(scene_file, "r") as f:
                    scene_data = json.load(f)
                    await websocket.send_json(
                        {"type": "scene_update", "scene": scene_data}
                    )
        except Exception as e:
            print(f"Error sending initial scene: {e}")

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                print(f"Received message: {message}")

                if message.get("type") == "scene_update":
                    # Save the scene update
                    scene_data = message.get("scene", {})
                    try:
                        scene_file = os.path.join(SCENES_DIR, "current_scene.json")
                        with open(scene_file, "w") as f:
                            json.dump(scene_data, f)
                    except Exception as e:
                        print(f"Error saving scene: {e}")

                    # Broadcast the scene update to all connected clients
                    await broadcast_scene_update(scene_data)
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Error handling message: {e}")
                break

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        async with clients_lock:
            clients.discard(websocket)
        try:
            await websocket.close()
        except Exception:
            pass
