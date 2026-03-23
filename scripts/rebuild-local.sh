#!/bin/bash

# Exit on error
set -e

. "$HOME/.profile"

: "${OPENCODE_LOCAL_USERNAME:?Set OPENCODE_LOCAL_USERNAME in ~/.profile}"
: "${OPENCODE_LOCAL_PASSWORD:?Set OPENCODE_LOCAL_PASSWORD in ~/.profile}"

echo "=> Rebuilding frontend..."
cd /home/rohansguliani/dev/opencode/packages/app
~/.bun/bin/bun run build

echo "=> Killing old backend server running on port 5000..."
lsof -ti:5000 | xargs kill -9 || true

echo "=> Starting backend server in the background..."
cd /home/rohansguliani/dev/opencode/packages/opencode
OPENCODE_SERVER_USERNAME="$OPENCODE_LOCAL_USERNAME" OPENCODE_SERVER_PASSWORD="$OPENCODE_LOCAL_PASSWORD" nohup ~/.bun/bin/bun run --conditions=browser ./src/index.ts serve --port 5000 > backend.log 2>&1 &

echo "=> Waiting for server to start..."
sleep 2

echo "=> Done! Server is running."
lsof -i :5000 || echo "WARNING: Could not verify if server is running."
