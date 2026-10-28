#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# BYO Aurora spell catalog for local demo (gitignored; copy from Character Builder)
export AURORA_ELEMENTS_ROOT="${AURORA_ELEMENTS_ROOT:-$ROOT_DIR/data/aurora-elements}"
if [ ! -d "$AURORA_ELEMENTS_ROOT" ]; then
  echo "Warning: AURORA_ELEMENTS_ROOT not found at $AURORA_ELEMENTS_ROOT (spell catalog disabled)"
fi

# BYO Fight Club 5e XML bestiary (gitignored; personal download under data/fc5)
export FC5_ROOT="${FC5_ROOT:-$ROOT_DIR/data/fc5}"
if [ ! -d "$FC5_ROOT" ]; then
  echo "Warning: FC5_ROOT not found at $FC5_ROOT (FC5 monster catalog disabled)"
fi

# Start the backend server
cd "$ROOT_DIR/backend"
uv sync --no-dev
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8010 &
BACKEND_PID=$!

# Start the frontend server
cd "$ROOT_DIR/frontend"
pnpm install
pnpm exec next dev -H 0.0.0.0 &
FRONTEND_PID=$!

# Handle cleanup
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait 