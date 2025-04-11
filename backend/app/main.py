from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import websocket
from app.core.connection_manager import connection_manager

app = FastAPI(title=settings.PROJECT_NAME)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(websocket.router, prefix="/api")

# Store the connection manager in the app state
app.state.connection_manager = connection_manager


@app.get("/")
async def root():
    return {"message": "Welcome to SpellTable API"}
