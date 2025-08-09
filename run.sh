#!/bin/bash

# Start the backend server
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8010 &
BACKEND_PID=$!

# Start the frontend server
cd ../frontend
npm install
npx next dev -H 0.0.0.0 &
FRONTEND_PID=$!

# Handle cleanup
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait 