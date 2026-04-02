# Improvement Review

## Scope

This is a code review note for the branch work around:

- combined view
- draggable projects
- global file panel
- workspace persistence
- grid mode / multi-session mode
- niri strip mode
- mobile swipe session navigation
- pinned sessions
- frozen/oracle mode
- `googlesearch`
- unified frontend serving for local Tailscale dev

Goal: identify places where the code can get faster, cleaner, or easier to maintain without changing behavior.

## Priorities

### 1. Reduce the cost of rendering many live sessions at once

Files:

- `packages/app/src/pages/session-grid.tsx`
- `packages/app/src/pages/session-strip.tsx`
- `packages/app/src/pages/session.tsx`

What is happening:

- Grid mode and strip mode mount a full `Session` tree per visible tile.
- Each mounted session carries prompt, file, comments, terminal, timeline, review, and scrolling logic.
- That is the single heaviest UI surface in this branch.

Why this matters:

- This is the biggest direct performance risk in the new feature set.
- Multi-session mode is exactly where users expect the app to stay responsive.
- Full session trees multiply expensive reactive work, DOM, editors, markdown, and data subscriptions.

Why it would be an improvement:

- Lazy mounting inactive tiles, suspending far-away tiles, or rendering lighter inactive shells would cut CPU, memory, and rerender pressure.
- This would make grid/niri feel intentionally fast instead of progressively heavier as more chats are open.

Suggested direction:

- Keep the focused session fully live.
- Degrade inactive sessions to a lighter state when possible.
- Consider mounting expensive subpanels only for the active tile.

### 2. Stop routing on hover in grid mode (DONE)

Files:

- `packages/app/src/pages/session-grid.tsx:174`
- `packages/app/src/pages/session-grid.tsx:336`

What is happening:

- Hovering an unfocused tile calls `navigate(..., { replace: true })` to move focus.
- That means simple mouse movement updates router state.

Why this matters:

- Router updates are much more expensive than local focus state.
- Hover can fire constantly, especially during drag, resize, or fast mouse movement.
- This increases unnecessary rerenders and makes multi-session mode more fragile.

Why it would be an improvement:

- Separating visual focus from URL persistence would reduce churn and make the grid feel smoother.
- The URL only needs to update when focus actually needs to persist, not on every hover pass.

Suggested direction:

- Keep hover focus local.
- Commit URL changes on click, keyboard focus, or a short debounce.

### 3. Remove dead sort invalidation work (DONE)

Files:

- `packages/app/src/pages/layout.tsx:315`
- `packages/app/src/pages/layout/sidebar-workspace.tsx:415`
- `packages/app/src/pages/layout/sidebar-project.tsx:340`
- `packages/app/src/pages/layout/helpers.ts:28`

What is happening:

- `layout.tsx` updates `sortNow` every minute.
- That value is threaded through multiple sidebar components.
- But `sortedRootSessions()` ignores the `_now` argument, so the minute tick does not change the actual result.

Why this matters:

- It creates avoidable reactive invalidation across major sidebar surfaces.
- The code looks like it is doing something important, but today it is just churn.

Why it would be an improvement:

- Removing dead invalidation work is free performance and makes the code easier to reason about.
- It also clarifies whether time-based resorting is actually needed.

Suggested direction:

- Either remove the timer path entirely, or make the sort truly depend on time.

### 4. Make pinned sessions cheaper and properly scoped (DONE)

Files:

- `packages/app/src/pages/layout/sidebar-workspace.tsx:293`
- `packages/app/src/pages/layout/sidebar-items.tsx:287`
- `packages/app/src/utils/pinned-sessions.ts`

What is happening:

- The sidebar splits pinned and unpinned sessions by filtering the same list twice.
- Pin checks use array `includes()` lookups.
- Pin state is stored globally by raw session id in localStorage.

Why this matters:

- The current implementation is simple, but it scales poorly as session counts grow.
- Global raw ids risk leaking pin state across servers or future id collisions.
- There is also a leftover fallback string in the UI: `PINNED_TEST` in `sidebar-workspace.tsx:314`.

Why it would be an improvement:

- Using a `Set` and a single partition pass is cleaner and faster.
- Scoping pins by server and workspace context would make the feature more correct and durable.

Suggested direction:

- Store pins in a keyed structure like `server -> pinned ids`.
- Expose a memoized set-based API.
- Remove the stray fallback label.

### 5. Restore workspace state more incrementally (DONE)

Files:

- `packages/app/src/pages/layout.tsx:223`
- `packages/app/src/pages/layout.tsx:263`
- `packages/app/src/pages/layout.tsx:1514`

What is happening:

- Workspace state restore eagerly loads session lists for all saved projects/workspaces.
- Project-open fallback logic can also fan out several session list requests.

Why this matters:

- This cost grows with the exact power-user workflows these features target.
- Combined view and multi-workspace usage make eager fanout more noticeable.

Why it would be an improvement:

- Prioritizing only the active project/workspace first would improve startup and project switching.
- Background hydration can still fill in the rest without blocking the main path.

Suggested direction:

- Load the active route first.
- Defer the rest in background batches.
- Add cancellation so stale restores do not keep doing work.

### 6. Cache recent project ranking in the directory picker

Files:

- `packages/app/src/components/dialog-select-directory.tsx:298`

What is happening:

- The picker computes recent projects by scanning every session in every project and sandbox.
- That runs reactively in the dialog path.

Why this matters:

- The picker should feel instant.
- This becomes more expensive as session counts grow, even though the UI only needs the top few projects.

Why it would be an improvement:

- Precomputing or caching project recency would keep the picker fast and reduce unnecessary repeated scans.

Suggested direction:

- Maintain per-project `lastUpdated` metadata when sessions change.
- Let the picker consume that instead of rescanning all sessions.

### 7. Centralize multi-session URL logic

Files:

- `packages/app/src/components/titlebar.tsx:139`
- `packages/app/src/pages/layout/sidebar-items.tsx:135`
- `packages/app/src/pages/layout/sidebar-workspace.tsx:526`
- `packages/app/src/pages/session-grid.tsx:174`
- `packages/app/src/pages/session-strip.tsx:38`
- `packages/app/src/app.tsx:64`
- `packages/app/src/utils/session-layout.ts`

What is happening:

- Grid and niri routing behavior is spread across titlebar toggles, sidebar clicks, new-session flows, grid focus, strip focus, and route entry.
- The helpers in `session-layout.ts` are useful, but too much behavior still lives ad hoc in call sites.

Why this matters:

- This is a high-regression area because the behavior is now cross-cutting.
- A bug in one path can easily drift from another path.

Why it would be an improvement:

- One canonical route builder/parser would make the feature easier to trust and extend.
- It would reduce subtle bugs around grid append, strip focus, workspace switching, and active session preservation.

Suggested direction:

- Move route construction and transition rules into one helper module.
- Treat "add session", "remove session", "focus session", and "toggle mode" as shared operations.

### 8. Centralize `?workspace=` parsing across app layers (DONE)

Files:

- `packages/opencode/src/server/server.ts:212`
- `packages/opencode/src/project/project.ts:98`
- `packages/opencode/src/session/index.ts:38`
- `packages/sdk/js/src/v2/client.ts:21`

What is happening:

- Directory/workspace parsing is duplicated with manual `decodeURIComponent(...).split("?workspace=")` logic.

Why this matters:

- Duplicated parsing logic drifts.
- Edge cases are easy to miss: encoded paths, query-like path content, Windows paths, malformed values.

Why it would be an improvement:

- A single shared parser/serializer would reduce bugs and make logical workspaces feel first-class instead of patched through.

Suggested direction:

- Introduce one parse/format utility used by SDK, server, session, and project code.
- Keep raw directory and logical workspace id separate all the way through.

### 9. Harden workspace-state syncing and actor identity

Files:

- `packages/app/src/pages/layout.tsx:223`
- `packages/app/src/pages/layout.tsx:282`
- `packages/app/src/utils/workspace-state.ts`
- `packages/opencode/src/control-plane/workspace-state.ts:68`
- `packages/opencode/src/server/server.ts:59`
- `packages/opencode/src/server/actor-context.ts`

What is happening:

- Workspace state is saved as a full blob with debounced whole-document writes.
- Server conflict handling is last-write-wins.
- User identity falls back to `local` when auth is absent.

Why this matters:

- Multi-tab or multi-machine usage can silently overwrite state.
- Shared or weakly-authenticated setups can merge unrelated users into the same actor bucket.
- This is exactly the sort of state users expect to be durable and correct.

Why it would be an improvement:

- Adding revision checks, merge semantics, or at least conflict detection would make persistence safer.
- Stronger actor derivation would make the feature behave more like a real per-user state store.

Suggested direction:

- Add a revision/version token to the saved blob.
- Reject or merge stale writes.
- Make actor identity more explicit than username-or-`local`.

### 10. Fold oracle mode back into the main prompt pipeline

Files:

- `packages/opencode/src/session/prompt.ts:196`
- `packages/opencode/src/session/prompt.ts:721`
- `packages/opencode/src/session/prompt.ts:1651`
- `packages/opencode/src/session/message-v2.ts:625`

What is happening:

- Oracle mode duplicates a large part of normal prompt execution with its own loop path.
- Frozen turns are marked by injecting a synthetic ignored text part with `metadata.frozen = true`.

Why this matters:

- Duplicated orchestration is expensive to maintain.
- New prompt behavior can land in one path and not the other.
- Encoding frozen state in a synthetic text part is clever, but brittle.

Why it would be an improvement:

- A shared execution pipeline with policy switches would reduce drift and make frozen/oracle behavior more reliable.
- A first-class frozen flag on message info would be clearer than a hidden text marker.

Suggested direction:

- Reuse one prompt loop with persistence/tool policy flags.
- Represent frozen state at the message level instead of via a synthetic ignored part.

### 11. Make `googlesearch` output shaping more robust (DONE)

Files:

- `packages/opencode/src/tool/googlesearch.ts:73`

What is happening:

- The tool takes the first candidate and first text part, then emits raw grounding chunks as markdown links.

Why this matters:

- Provider responses are not always perfectly shaped.
- Duplicate or low-quality grounding entries will leak straight into tool output.

Why it would be an improvement:

- Small output-shaping improvements would make the tool feel more reliable without changing the core idea.
- Better source normalization would improve answer quality and readability.

Suggested direction:

- Handle missing/partial candidate shapes more defensively.
- Deduplicate sources by URL.
- Optionally normalize titles and limit noisy grounding output.

### 12. Extract shared file-tab panel behavior

Files:

- `packages/app/src/pages/layout/project-file-panel.tsx`
- `packages/app/src/pages/session/session-side-panel.tsx`

What is happening:

- File tab open/reorder/render behavior now exists in two separate panels with very similar code.

Why this matters:

- This is a classic drift point.
- Future tab UX changes will likely need to be fixed twice.

Why it would be an improvement:

- Extracting shared behavior would reduce duplication and make the global file panel feel like a true evolution of the existing tab system instead of a parallel copy.

Suggested direction:

- Share the tab-strip and drag/reorder setup.
- Keep panel-specific layout differences separate.

## Recommended Order

If the goal is fast, clean code with the best payoff first:

1. Reduce multi-session render cost.
2. Stop hover-driven router churn.
3. Centralize multi-session routing logic.
4. Remove dead sort invalidation work.
5. Harden workspace persistence semantics.

## Notes

- No code changes were made as part of this review.
- This document is meant to guide follow-up cleanup and optimization discussion.
