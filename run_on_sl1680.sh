#!/bin/bash

# Start the backend server
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8010 &
BACKEND_PID=$!

# Start the frontend server
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

# Open the frontend in the browser
export WAYLAND_DISPLAY=wayland-1
export XDG_RUNTIME_DIR=/run/user/0
chromium   --enable-features=UseOzonePlatform   --ozone-platform=wayland   --disable-gpu   --disable-software-rasterizer   --no-sandbox   --kiosk http://localhost:3000/viewer &
CHROME_PID=$!


# Handle cleanup
trap "kill $BACKEND_PID $FRONTEND_PID $CHROME_PID; exit" INT TERM
wait 