# Rebuild Local Tailscale Dev Server

Use this when testing the machine's development ingress served through the Tailscale Funnel.

The machine-level architecture is documented in `notes/thinkpadMachine/architecture_truth.md`.

## What This Rebuild Does

`./scripts/rebuild-local.sh` updates the development Tailscale path by doing two things:

1. rebuilds the frontend into `packages/app/dist`
2. restarts the unified backend on port `5000`

That `5000` process serves both the built frontend and the API on the same origin.

## Why This Exists

The Tailscale development URL points at `5000`, not `4444`.

- `4444` is only the optional local Vite dev server
- `5000` is the remote-facing development server for this machine
- same-origin serving on `5000` avoids the browser Basic Auth issues that happened with split frontend/backend origins

## Preferred Command

```bash
cd /home/rohansguliani/dev/opencode
./scripts/rebuild-local.sh
```

## Manual Equivalent

```bash
cd /home/rohansguliani/dev/opencode/packages/app
~/.bun/bin/bun run build

cd /home/rohansguliani/dev/opencode/packages/opencode
. "$HOME/.profile"
OPENCODE_SERVER_USERNAME="$OPENCODE_LOCAL_USERNAME" OPENCODE_SERVER_PASSWORD="$OPENCODE_LOCAL_PASSWORD" nohup ~/.bun/bin/bun run --conditions=browser ./src/index.ts serve --port 5000 > backend.log 2>&1 &
```

## Verification

The hardened script now verifies that:

- `packages/app/dist/index.html` exists after the build
- port `5000` is actually free before restart
- the new backend process stays alive during startup
- `http://127.0.0.1:5000` responds with `200` or `401`

If the script fails, read `packages/opencode/backend.log`.
