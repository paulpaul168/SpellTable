from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any
import json
from ..core.config import create_app

router = APIRouter()
app = create_app()

# Store connected clients
clients: Dict[WebSocket, Any] = {}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        # Use the connection manager to handle the connection
        await app.state.connection_manager.connect(websocket)

        # Send initial connection success message
        await websocket.send_json({"type": "connection_status", "status": "connected"})

        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                print(f"Received message: {message}")

                if message.get("type") == "scene_update":
                    # Broadcast the scene update to all connected clients
                    await app.state.connection_manager.broadcast(data)
                else:
                    # Echo other messages back to the sender
                    await websocket.send_text(data)
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
        app.state.connection_manager.disconnect(websocket)
