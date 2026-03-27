# Global File Panel

## Idea
When the file-tree button in the session header is toggled, the file browser should open once at the app level on the right side of the window.

## Goal
- stop rendering the file tree inside every chat surface
- scope the file browser to the current project/workspace instead of a specific chat
- keep one shared right-side file area across normal, grid, and niri modes
- preserve per-session review panels while moving the project file browser out to the layout shell

## Current Implementation Notes
- `packages/app/src/pages/layout.tsx` now mounts a single app-level project file panel.
- That panel is wrapped in workspace-scoped `SessionParamsProvider`, `FileProvider`, `PromptProvider`, and `CommentsProvider` so file browsing is attached to the current workspace rather than one chat.
- `packages/app/src/pages/layout/project-file-panel.tsx` renders the shared file tabs plus file tree on the far right edge of the app.
- `packages/app/src/pages/session/session-side-panel.tsx` no longer renders the file tree; it only manages the per-session review/file tab area.
