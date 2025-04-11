from fastapi import APIRouter, WebSocket
from app.core.connection_manager import connection_manager
import json

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await connection_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # If it's a scene update, broadcast it to all clients
                if message.get("type") == "scene_update":
                    print(f"Received scene update: {message}")
                    await connection_manager.broadcast(data)
                # For other message types, just broadcast as is
                else:
                    await connection_manager.broadcast(data)
            except json.JSONDecodeError:
                # If it's not valid JSON, just broadcast the raw text
                await connection_manager.broadcast(data)
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        connection_manager.disconnect(websocket)
