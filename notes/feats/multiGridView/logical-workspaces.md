# Logical Workspaces

## Problem
Grid Mode makes it useful to open multiple contexts over the same physical repo. The original app model treated `directory` as both:
- the real filesystem location
- the identity key for project/session state

That broke down immediately once multiple workspaces needed to share one folder but keep separate chats, DB state, and sidebar state.

## Approach
- Keep one physical directory.
- Attach a logical suffix, `?workspace=<id>`, anywhere the client needs a unique workspace identity.
- Strip that suffix anywhere code needs the real disk path.
- Preserve that suffix anywhere code needs stable workspace routing or scoped client state.

## Fixes Landed

### Identity Plumbing
- Added shared workspace parsing helpers so the app can split, join, strip, and label logical workspace paths consistently.
- Fixed SDK/bootstrap/path resolution so workspace identity survives routing, refresh, and project switching.
- Fixed server `/path` responses so the active logical workspace identity is reflected back to the client instead of collapsing to the physical directory.

### Project and Session Isolation
- Fixed `Project.fromDirectory(...)` usage so the backend never tries to treat `/real/path?workspace=...` as an actual filesystem path.
- Fixed session visibility filters to require both matching base directory and matching `workspaceID`.
- Fixed session list queries so archived sessions do not leak into the root-session pagination heuristics used by the sidebar.

### Naming and Display
- Centralized display-name fallback logic so labels always derive from the stripped physical path.
- Removed the ugly `?workspace=wrk_...` artifact from workspace names, tooltips, recent project rows, and path text.

## Result
Logical workspaces now behave like isolated chat contexts layered on top of one repo, instead of hacks that sometimes masquerade as different folders.
