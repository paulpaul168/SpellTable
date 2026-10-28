#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# BYO Aurora spell catalog for local demo (gitignored)
export AURORA_ELEMENTS_ROOT="${AURORA_ELEMENTS_ROOT:-$ROOT_DIR/data/aurora-elements}"
# BYO Fight Club 5e XML bestiary (gitignored)
export FC5_ROOT="${FC5_ROOT:-$ROOT_DIR/data/fc5}"

# Start the backend server
cd "$ROOT_DIR/backend"
uv sync --no-dev
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8010 &
BACKEND_PID=$!

# Start the frontend server
cd "$ROOT_DIR/frontend"
pnpm install
pnpm run dev &
FRONTEND_PID=$!

# Open the frontend in the browser
export WAYLAND_DISPLAY=wayland-1
export XDG_RUNTIME_DIR=/run/user/0
chromium   --enable-features=UseOzonePlatform   --ozone-platform=wayland   --disable-gpu   --disable-software-rasterizer   --no-sandbox   --kiosk http://localhost:3000/viewer &
CHROME_PID=$!


# Handle cleanup
trap "kill $BACKEND_PID $FRONTEND_PID $CHROME_PID; exit" INT TERM
wait 