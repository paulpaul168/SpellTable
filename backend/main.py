"""
This module is the entry point for the FastAPI app.
"""

import uvicorn
from app.core.config import create_app
from app.routes import audio, maps, scenes, websocket

app = create_app()

# Include routers
app.include_router(websocket.router)
app.include_router(scenes.router, prefix="/scenes")
app.include_router(audio.router, prefix="/audio")
app.include_router(maps.router, prefix="/maps")


@app.get("/")
async def root() -> dict[str, str]:
    """
    Root endpoint for the FastAPI app.
    """
    return {"message": "Welcome to SpellTable API"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
