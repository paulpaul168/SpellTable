"""
This module contains the audio routes for the FastAPI app.
"""

import asyncio
import mimetypes
from pathlib import Path
from typing import Any, AsyncGenerator, Generator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

router = APIRouter()

# Define the path to the sounds directory
SOUNDS_DIR = Path(__file__).parent.parent.parent.parent / "backend" / "sounds"


def stream_file(file_path: Path) -> Generator[bytes, None, None]:
    """Stream a file in chunks to avoid loading the entire file into memory."""
    chunk_size = 1024 * 64  # 64KB chunks
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            yield chunk


async def async_stream_generator(file_path: Path) -> AsyncGenerator[bytes, None]:
    """Wrap the synchronous generator in an async context."""
    # Create a thread pool executor for the blocking file operations
    loop = asyncio.get_event_loop()

    # Start streaming in a separate thread
    for chunk in await loop.run_in_executor(None, lambda: list(stream_file(file_path))):
        yield chunk


@router.get("/file/{category}/{filename:path}")
async def get_audio_file(category: str, filename: str) -> StreamingResponse:
    """
    Stream an audio file from the sounds directory in a separate thread.
    Category should be 'loop' or 'oneshot'.
    Filename should include subfolders if necessary (e.g., 'Ambience/Tavern/tavern-ambience.mp3').
    """
    try:
        # Validate the category
        if category not in ["loop", "oneshot"]:
            raise HTTPException(
                status_code=400, detail="Invalid category. Must be 'loop' or 'oneshot'"
            )

        file_path = SOUNDS_DIR / category / filename

        # Check if the file exists
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=404, detail=f"Audio file not found: {filename}"
            )

        # Add MIME type for mp3 files
        mimetypes.add_type("audio/mpeg", ".mp3")
        media_type = mimetypes.guess_type(file_path)[0]

        # Stream the file instead of returning it all at once
        return StreamingResponse(
            async_stream_generator(file_path),
            media_type=media_type,
            headers={
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Cache-Control": "public, max-age=86400",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/list")
async def list_audio_files() -> dict[str, dict[str, list[dict[str, Any]]]]:
    """
    List all available audio files organized by category and type.
    """
    try:
        print(f"SOUNDS_DIR in list_audio_files: {SOUNDS_DIR}")
        print(f"SOUNDS_DIR exists: {SOUNDS_DIR.exists()}")

        audio_files: dict[str, dict[str, list[dict[str, Any]]]] = {
            "loop": {},
            "oneshot": {},
        }

        # Function to scan directories recursively
        def scan_directory(
            directory: Path, category: str, current_path: str = ""
        ) -> dict[str, list[dict[str, Any]]]:
            print(f"Scanning directory: {directory}, exists: {directory.exists()}")
            result: dict[str, list[dict[str, Any]]] = {}

            try:
                for item in directory.iterdir():
                    rel_path = str(Path(current_path) / item.name)

                    if item.is_file() and item.suffix.lower() == ".mp3":
                        # Calculate path for frontend URL
                        url_path = f"/audio/file/{category}/{rel_path}"

                        # Generate a unique ID based on the path
                        file_id = (
                            rel_path.replace("/", "-")
                            .replace("\\", "-")
                            .replace(" ", "_")
                            .lower()
                        )
                        if file_id.endswith(".mp3"):
                            file_id = file_id[:-4]

                        # Add file info with fixed loop setting based on category
                        is_loop = category == "loop"

                        # Get the name - use the filename without extension
                        name = item.stem.replace("-", " ").title()

                        file_info = {
                            "id": file_id,
                            "name": name,
                            "type": "music" if is_loop else "effect",
                            "url": url_path,
                            "loop": is_loop,
                            "randomize": is_loop,  # Randomize for loops only
                            "path": rel_path,
                        }

                        # Add file to the current directory structure
                        if current_path not in result:
                            result[current_path] = []
                        result[current_path].append(file_info)

                    elif item.is_dir():
                        # Recursively scan subdirectories
                        subdir_result = scan_directory(item, category, rel_path)
                        result.update(subdir_result)
            except Exception as e:
                print(f"Error scanning directory {directory}: {str(e)}")

            return result

        # Scan loop and oneshot directories
        loop_dir = SOUNDS_DIR / "loop"
        oneshot_dir = SOUNDS_DIR / "oneshot"

        logger.debug(f"Loop dir: {loop_dir}, exists: {loop_dir.exists()}")
        logger.debug(f"Oneshot dir: {oneshot_dir}, exists: {oneshot_dir.exists()}")

        if loop_dir.exists():
            audio_files["loop"] = scan_directory(loop_dir, "loop")

        if oneshot_dir.exists():
            audio_files["oneshot"] = scan_directory(oneshot_dir, "oneshot")

        print(f"Audio files found: {audio_files}")
        return audio_files

    except Exception as e:
        print(f"Error in list_audio_files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e
