from fastapi.websockets import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        print(
            f"New WebSocket connection established. Total connections: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.remove(websocket)
        print(
            f"WebSocket connection closed. Remaining connections: {len(self.active_connections)}"
        )

    async def broadcast(self, message: str) -> None:
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error broadcasting message: {e}")
                self.disconnect(connection)


# Create a global instance
connection_manager = ConnectionManager()
