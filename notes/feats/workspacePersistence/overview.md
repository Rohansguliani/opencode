# Workspace Persistence

## Problem

Open workspaces currently behave like local UI state, not durable user state.

Today the app keeps them in browser/desktop persistence only:
- open root projects live in `packages/app/src/context/server.tsx`
- workspace ordering/expanded state lives in `packages/app/src/pages/layout.tsx`

That causes a few failures:
- refresh can appear to lose open workspaces
- switching app origins or server keys can land in a different local bucket
- another computer cannot restore the same workspace setup

Chats do not have this problem because chats are stored on the server.

## Goal

Make workspace state feel like chats:
- durable on the server
- scoped to the current user
- restorable across refreshes and computers
- still fast in the UI

## Chosen Direction

Use a server-backed state blob for workspace UI state.

Store, per user on a given server:
- open root projects
- last active project
- active project/workspace
- workspace order
- workspace expanded/collapsed state
- workspace custom names / branch display names

Why a blob instead of many tiny rows:
- faster to ship
- fast for the user: one fetch on boot, one debounced write on change
- mirrors the current client state model directly
- keeps the fix surgical instead of rewriting the sidebar architecture

## User Identity

The server needs a stable actor key.

Current plan:
- derive it from Basic Auth username when present
- fall back to `local` when the server is effectively single-user

That gives cross-computer restore for the common remote-server case where the same user signs into the same backend from multiple machines.

## Client Strategy

- keep local persistence as a cache / fallback
- fetch server workspace state after boot
- hydrate the sidebar from server state when available
- debounce writes back to the server after workspace changes

This keeps the UI snappy while making the server authoritative.

## Backend Strategy

- add a new `workspace_state` table keyed by actor
- expose `GET /global/workspace-state`
- expose `PATCH /global/workspace-state`
- keep the payload narrow and focused on workspace UI state only

## Notes

- This is intentionally separate from `ProjectTable` and `WorkspaceTable`
- project/workspace records are shared server objects
- open/expanded/ordered is user preference state, so it belongs in a user-scoped store
