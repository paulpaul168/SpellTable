from app.core.config import create_app
from app.routes import maps, websocket, scenes
import uvicorn

app = create_app()

# Include routers
app.include_router(maps.router)
app.include_router(websocket.router)
app.include_router(scenes.router, prefix="/scenes")


@app.get("/")
async def root():
    return {"message": "Welcome to SpellTable API"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
