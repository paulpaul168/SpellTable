from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any
import json

router = APIRouter()

# Store connected clients
clients: Dict[WebSocket, Any] = {}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        # Accept the WebSocket connection
        await websocket.accept()
        clients[websocket] = None

        # Send initial connection success message
        await websocket.send_json({"type": "connection_status", "status": "connected"})

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                print(f"Received message: {message}")

                if message.get("type") == "scene_update":
                    # Broadcast the scene update to all connected clients
                    for client in clients:
                        if client != websocket:  # Don't send back to sender
                            await client.send_json(message)
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Error handling message: {e}")
                break

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket in clients:
            del clients[websocket]
        await websocket.close()
