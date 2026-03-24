# Opencode Environment

For this machine, the canonical port and ingress mapping lives in `notes/thinkpadMachine/architecture_truth.md`.

## Quick Summary

- Production remote access: Zrok -> `4097`
- Development remote access: Tailscale Funnel -> `5000`
- Baseline local systemd service: `4096`
- Optional local Vite UI dev server: `4444`

## Important

Older notes may still mention the pre-inversion setup where Tailscale pointed at production and the dev instance used a different public tunnel. On this ThinkPad, do not trust those older assumptions over `notes/thinkpadMachine/architecture_truth.md`.
