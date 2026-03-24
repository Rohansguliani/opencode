#!/bin/bash

set -euo pipefail

. "$HOME/.profile"

: "${OPENCODE_LOCAL_USERNAME:?Set OPENCODE_LOCAL_USERNAME in ~/.profile}"
: "${OPENCODE_LOCAL_PASSWORD:?Set OPENCODE_LOCAL_PASSWORD in ~/.profile}"

root="/home/rohansguliani/dev/opencode"
app="$root/packages/app"
srv="$root/packages/opencode"
log="$srv/backend.log"
url="http://127.0.0.1:5000"

echo "=> Rebuilding frontend..."
cd "$app"
~/.bun/bin/bun run build

if [ ! -f "$app/dist/index.html" ]; then
  echo "ERROR: frontend build completed but $app/dist/index.html is missing."
  exit 1
fi

echo "=> Stopping backend on port 5000..."
pid="$(lsof -ti:5000 || true)"
if [ -n "$pid" ]; then
  kill $pid || true
  for _ in $(seq 1 20); do
    if ! lsof -ti:5000 >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

if lsof -ti:5000 >/dev/null 2>&1; then
  echo "=> Port 5000 is still busy, forcing shutdown..."
  lsof -ti:5000 | xargs kill -9 || true
  sleep 1
fi

if lsof -ti:5000 >/dev/null 2>&1; then
  echo "ERROR: port 5000 is still in use after shutdown attempts."
  lsof -i :5000 || true
  exit 1
fi

echo "=> Starting backend server in the background..."
cd "$srv"
: > "$log"
OPENCODE_SERVER_USERNAME="$OPENCODE_LOCAL_USERNAME" OPENCODE_SERVER_PASSWORD="$OPENCODE_LOCAL_PASSWORD" nohup ~/.bun/bin/bun run --conditions=browser ./src/index.ts serve --port 5000 > "$log" 2>&1 &
pid=$!

echo "=> Waiting for backend to pass health check..."
for _ in $(seq 1 30); do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "ERROR: backend exited during startup."
    cat "$log"
    exit 1
  fi

  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" || true)"
  if [ "$code" = "200" ] || [ "$code" = "401" ]; then
    echo "=> Done! Backend is responding on port 5000 (HTTP $code)."
    lsof -i :5000 || true
    exit 0
  fi

  sleep 1
done

echo "ERROR: backend did not become ready on port 5000 in time."
cat "$log"
exit 1
