# Recompiling and Restarting the Local Server (Tailscale Setup)

When making changes to the UI or backend on the Tailscale local testing branch (`feat/tailscale-local-serve`), you must recompile the frontend and restart the backend server so the changes take effect over the Tailscale Funnel.

> **CRITICAL WARNING:** In `server.ts`, the static path resolution MUST use `path.resolve(__dirname, "../../../app/dist")`. If you accidentally use `process.cwd()`, it will resolve incorrectly, fail silently, and proxy the user to `app.opencode.ai` (the live production server), making it seem like your local changes aren't working.

**For Future Agents:** If you are asked to "apply changes", "recompile", or "restart the server" for testing, strictly follow these steps.

## 1. Preferred Shortcut

Use the helper script whenever possible:

```bash
cd /home/rohansguliani/dev/opencode
./scripts/rebuild-local.sh
```

It rebuilds the frontend, restarts the backend, and reads credentials from `~/.profile`.

## 2. Manual Rebuild the Frontend

The frontend must be compiled into static files in the `packages/app/dist` directory. The custom backend server is configured to serve this static directory directly.

```bash
cd /home/rohansguliani/dev/opencode/packages/app
~/.bun/bin/bun run build
```

## 3. Kill the Existing Backend Process

Find the process running on port `5000` and kill it.

```bash
# Find the PID
lsof -i :5000

# Kill the process
kill <PID>
```

## 4. Restart the Backend

Start the backend on port `5000` while passing in the Basic Auth credentials via environment variables. It must be run in the background (using `nohup` and `&`) so it doesn't die when the shell session ends.

```bash
cd /home/rohansguliani/dev/opencode/packages/opencode

. "$HOME/.profile"
OPENCODE_SERVER_USERNAME="$OPENCODE_LOCAL_USERNAME" OPENCODE_SERVER_PASSWORD="$OPENCODE_LOCAL_PASSWORD" nohup ~/.bun/bin/bun run --conditions=browser ./src/index.ts serve --port 5000 > backend.log 2>&1 &
```

## 5. Verify

Ensure the server successfully booted and bound to the port.

```bash
# Wait a second for it to boot
sleep 2

# Check if it's listening on port 5000
lsof -i :5000

# Check the logs for errors
cat /home/rohansguliani/dev/opencode/packages/opencode/backend.log
```

Once this is done, the user can refresh their Tailscale URL (`https://rohansguliani-thinkpad-x1-yoga-gen-8.tail77ef27.ts.net/`) to see the latest changes!
