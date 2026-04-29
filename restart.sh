#!/bin/bash

# Kill backend on port 4096
PID_4096=$(lsof -t -i:4096)
if [ -n "$PID_4096" ]; then
  echo "Killing backend on port 4096 (PID $PID_4096)..."
  kill -9 $PID_4096
fi

# Kill frontend on port 3000 or 3001
PID_FRONTEND=$(lsof -t -i:3000,3001)
if [ -n "$PID_FRONTEND" ]; then
  echo "Killing frontend on port 3000/3001 (PID $PID_FRONTEND)..."
  kill -9 $PID_FRONTEND
fi

echo "Starting backend..."
export OPENCODE_DISABLE_SHARE=true
npm run dev --prefix packages/opencode > backend.log 2>&1 &

echo "Starting frontend..."
npm run dev --prefix packages/app > frontend.log 2>&1 &

echo "Both processes started in background. Check logs in backend.log and frontend.log"
