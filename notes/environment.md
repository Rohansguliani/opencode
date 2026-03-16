# Opencode Dev Environment

## Overview
This is a personal, isolated development instance of OpenCode, running independently of the primary production instance.

## Production (Tailscale)
- **Port:** 4096
- **Status:** Main systemd service, accessed via Tailscale Funnel.
- **URL:** https://rohansguliani-thinkpad-x1-yoga-gen-8.tail77ef27.ts.net/

## Development (Ngrok)
- **Backend Port:** 4097
- **Public URL:** https://muscular-rema-unshaved.ngrok-free.dev
- **Status:** Manual process, see ~/opencode_notes/OpenCode Dev Instance Setup.md for startup commands.

## Important Note
The dev and production instances currently share the same database (`~/.local/share/opencode/opencode.db`).
Use a separate workspace manually to avoid polluting production sessions.

## Commands
See full documentation in: `~/opencode_notes/OpenCode Dev Instance Setup.md`
