# Speed Improvements

## Overview

This feature covers a series of high-impact performance and latency improvements to the application, specifically targeting multi-session layouts (Grid and Strip mode), active session rendering, and cold-start/refresh times.

## 1. Focused Session Optimization (Degrading Inactive Tiles)

In multi-session modes like Grid, having multiple full `Session` components mounted concurrently caused massive CPU and memory churn. This was fixed by separating lightweight reading state from heavy interactive state.

- **Changes:**
  - Added an `active` prop to the `Session` component.
  - Wrapped the heaviest interactive components (`SessionComposerRegion`, `SessionSidePanel`, `TerminalPanel`) in a `<Show when={active()}>` block.
  - Replaced the inactive composer with a lightweight, read-only "ghost" composer that mirrors the prompt state text but avoids instantiating ProseMirror.
  - Disabled expensive reactive effects (auto-scroll, active diff calculation, active file tab tracking, keyboard event listeners, and follow-up queuing) for inactive sessions via the `active()` check.
  - In `session-grid.tsx` and `session-strip.tsx`, the `active` prop is passed down based on which tile currently has focus. Focus in grid mode was updated to only trigger on explicit clicks (or after a 150ms hover debounce), preventing router-level `navigate` churn on every mouse movement.

## 2. Combined View Simplification

The application previously supported multiple sidebar layout modes (project rail + side panel vs combined view) and a complex workspace enablement toggle. This was consolidated to reduce UI overhead and simplify the routing and rendering path.

- **Changes:**
  - Removed the legacy `sidebar-project.tsx` and `sidebar-shell.tsx` implementations entirely.
  - Made the `CombinedSidebar` the single, default source of truth for the left navigation pane.
  - Removed the `combinedMode` state and toggle from the titlebar.
  - Removed the "Enable/Disable Workspaces" action; all projects are now treated as workspaces automatically.
  - Tightened the combined sidebar UI by removing the text header and moving the settings and help actions to a quieter bottom-right corner.

## 3. Prioritized Lazy Sidebar Hydration

On application refresh, the sidebar would aggressively try to load session lists for all known workspaces simultaneously. This starved the main session rendering of network and CPU resources.

- **Changes:**
  - Sidebar hydration is now queued based on user relevance instead of a massive `Promise.all`.
  - Priority order:
    1. The currently focused session(s) in the URL route
    2. The workspace containing the focused session
    3. Other workspaces in the current project
    4. All other projects/workspaces
  - Background loading is managed by a `pumpWorkspaces` queue that limits concurrent bootstraps (`hydrateMax = 1`).
  - `currentSessions` mapping now uses `bootstrap: false` so evaluating the sidebar list does not accidentally force every workspace to perform its heavy setup work on initial render.

## 4. The Data Waterfall (Eager Fetching)

The initial data load for the active session used to wait for the entire UI layout and sidebar to finish rendering before realizing it needed to fetch the actual messages for the chat on screen.

- **Changes:**
  - Explicitly added a `prefetchSession(activeSession, "high")` trigger during the `layout.tsx` setup phase.
  - As soon as the URL is parsed and the layout state initializes, the message fetch for the active session races the UI rendering concurrently, cutting down time-to-first-paint.

## 5. Offline-First Message Caching

To completely hide the network latency of loading a chat on refresh or navigation, the app now uses local storage to maintain a rolling snapshot of the most recent messages.

- **Changes:**
  - In `sync.tsx`, whenever messages are loaded, the last 20 messages and their associated parts are synced to `localStorage` under `opencode.recent.[sessionID]`.
  - When the app attempts to sync a session on boot, it first synchronously checks `localStorage`. If recent messages exist, it instantly populates the store (`setStore("message", ...)`).
  - This allows the UI to paint the transcript in 0ms from local memory while the background network request (`sync.session.sync`) runs silently to fetch any missed updates and resolve `reconcile` changes.

## 6. Heavy DOM Rendering Deferral (CPU Unblocking)

Even when messages arrive instantly from the cache, synchronously booting the interactive plugins (ProseMirror, Xterm.js, diff viewers) stalls the browser's main thread and delays the initial frame paint.

- **Changes:**
  - Added a `heavyActive` signal to `session.tsx` that relies on an `onMount` timer.
  - The heavy interactive components (`TerminalPanel`, `SessionSidePanel`, `SessionComposerRegion`) are delayed by a strict 150ms.
  - The app paints the chat transcript and the static "ghost" composer instantly, lets the browser breathe and render the frame, and _then_ initializes the heavy plugins in the background once the UI is visually stable.
