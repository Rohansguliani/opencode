# Branch State

This document tracks the current state of branches used in the OpenCode development workflow.

## Non-PR Branch: `feat/tailscale-local-serve`
This is the long-lived local integration branch. It is currently being served on the Tailscale proxy and contains:
1. **The Base:** `origin/dev`
2. **Local Environment:** Commits configuring Tailscale proxy and static frontend serving.
3. **Accumulated Features (Cherry-Picked from PR Branches):**
   - Horizontal mobile swipe navigation
   - Session list sorting fix (cherry-picked from `fix-session-sort` branch)
   - *Working on:* Pinned sessions, deleting sessions, and UI cleanup.

## Active PR Branches (Clean)
- `fix-session-sort`: Fixes the bug where oldest sessions appeared at the top. (PR #17848)

*Note: Features are developed on clean feature branches off `origin/dev` and cherry-picked into `feat/tailscale-local-serve` for testing. Once tested, the feature branches are pushed to GitHub as PRs.*
