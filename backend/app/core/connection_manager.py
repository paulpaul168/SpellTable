"""
This module contains the connection manager for the FastAPI app.
"""

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger


class ConnectionManager:
    """
    Manages WebSocket connections.

    Attributes:
        active_connections (list[WebSocket]): The list of active WebSocket connections.
    """

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """
        Accept a new WebSocket connection.

        Args:
            websocket (WebSocket): The WebSocket connection to accept.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            f"New WebSocket connection established. \
                Total connections: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """
        Close a WebSocket connection.

        Args:
            websocket (WebSocket): The WebSocket connection to close.
        """
        self.active_connections.remove(websocket)
        logger.info(
            f"WebSocket connection closed. Remaining connections: {len(self.active_connections)}"
        )

    async def broadcast(self, message: str) -> None:
        """
        Broadcast a message to all active connections.

        Args:
            message (str): The message to broadcast.
        """
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except (WebSocketDisconnect, RuntimeError, ConnectionError) as e:
                logger.exception(f"Error broadcasting message: {e}")
                self.disconnect(connection)


# Create a global instance
connection_manager = ConnectionManager()
