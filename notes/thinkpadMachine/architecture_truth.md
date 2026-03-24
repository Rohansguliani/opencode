# ThinkPad Machine Architecture

This file mirrors the current source of truth from `~/opencode_notes/thinkpadSetup/architecture_truth.md` for the machine-specific OpenCode setup on this ThinkPad.

## Current Ingress Reality

The historical mapping was inverted on this machine.

- Production remote access goes through Zrok to port `4097`.
- Development remote access goes through the Tailscale Funnel to port `5000`.
- Port `4096` is the long-running systemd OpenCode service, but it is not the public remote entrypoint.

## Port Map

| Port | Role | Exposure | Notes |
| --- | --- | --- | --- |
| `4096` | systemd orchestrator | local only | baseline service `opencode-web.service` |
| `4097` | production backend | Zrok | primary remote-control backend on this machine |
| `5000` | development unified static server | Tailscale Funnel | serves built frontend and API on one origin |
| `4444` | local Vite dev server | local only | optional local UI dev server, not part of remote ingress |

## Public URLs

- Production: `https://jdsvx0dw2om3.share.zrok.io/`
- Development: `https://rohansguliani-thinkpad-x1-yoga-gen-8.tail77ef27.ts.net/`

## Why `5000` Exists

The Tailscale development path uses a single origin on port `5000` so the browser keeps Basic Auth credentials attached to API requests. That is why `./scripts/rebuild-local.sh` builds `packages/app/dist` and then starts the backend on `5000` instead of relying on the separate Vite dev server.

## Operational Warnings

- `4097` and `5000` currently share the same database state.
- Restarting the `4096` systemd service can kill child processes that were launched from inside that environment.
- `4444` is useful for local UI iteration, but it is not the path the Tailscale Funnel serves.
