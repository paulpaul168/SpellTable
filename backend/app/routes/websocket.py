from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any
import json

router = APIRouter()

# Store connected clients
clients: Dict[WebSocket, Any] = {}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        await websocket.accept()
        clients[websocket] = None

        # Send initial connection success message
        await websocket.send_json({"type": "connection_status", "status": "connected"})

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                if message.get("type") == "scene_update":
                    # Broadcast the scene update to all connected clients
                    for client in clients:
                        if client != websocket:  # Don't send back to the sender
                            await client.send_text(data)
                else:
                    # Echo other messages back to the sender
                    await websocket.send_text(f"Message received: {data}")
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Error handling message: {e}")
                break
    except WebSocketDisconnect:
        print("Client disconnected normally")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        clients.pop(websocket, None)  # Remove client from connected clients
