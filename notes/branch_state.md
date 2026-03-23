# Branch State

This file describes branch roles, not a live checklist of every current feature.

## Non-PR Branch: `feat/tailscale-local-serve`

This is the long-lived local integration branch used for testing changes against the custom local/Tailscale setup.

It contains:
- `origin/dev` as the base
- local environment commits needed for local serving and auth
- cherry-picked feature/fix commits that have been tested locally

## Clean PR Branches

Clean PR branches should:
- branch from `origin/dev`
- contain only the focused change for the PR
- be pushed to the `rohan` fork
- never include local-only environment changes from `feat/tailscale-local-serve`

## Rule Of Thumb

- Test on `feat/tailscale-local-serve`
- Open PRs from a clean branch off `origin/dev`
- Use `notes/pr_runbook.md` for the exact workflow
