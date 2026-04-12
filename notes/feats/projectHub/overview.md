# Project Hub (The Project Command Center)

## The Goal
In current AI coding agents, projects or workspaces merely act as static folders containing a list of past sessions. **Project Hub** transforms the project itself into an active, promptable space. 

By clicking the project header in the `CombinedSidebar`, the user enters a "Command Center" (or Lobby) for that specific workspace. Here, they can search across all past context, ask high-level questions about the workspace's history, and quickly dive back into previous threads—all without cluttering their database with single-turn "search" chats.

## The Two-Tiered Interaction Model: Search vs. Ask
The core of the Project Hub is the **Omnibar**, a prominent input field at the top of the view. It serves two distinct purposes seamlessly:

1. **Instant Local Search (Filtering):**
   As the user types, the list of sessions displayed in the Lobby below the Omnibar is instantly filtered. This relies entirely on fast, local SQLite querying without any LLM latency.
2. **The Project Oracle (Asking):**
   If the user presses `Enter`, the input transitions from a local filter to an LLM prompt. The backend aggregates the most relevant context from the project's history and streams back a stateless answer.

---

## Technical Architecture & Implementation Strategy

### 1. Frontend State & UI (`packages/app`)
- **Routing:** Introduce a new route, e.g., `/project/:projectId/hub`. Clicking a top-level project in `sidebar-combined.tsx` navigates here instead of merely toggling expansion state.
- **The Omnibar (`ProjectComposer`):** A large input component at the top of the Hub view. It binds its value to a local reactive signal used for the instant UI filtering.
- **The Lobby:** A grid or list displaying `SessionCard` components. It maps over the workspace's sessions, applying the local text filter against session titles and (potentially) cached message excerpts.
- **Ephemeral State Rendering:** When the user submits a prompt, an `<EphemeralCard>` component mounts directly below the Omnibar. It streams the LLM's response. Navigating away from the Hub destroys this state.

### 2. Backend API & Context Retrieval (`packages/opencode`)
Because the application runs locally and uses SQLite, we must be intelligent about context retrieval without relying on heavy external vector databases.

- **Full-Text Search (FTS5):** 
  To support both the instant UI filtering and the backend context aggregation, we should leverage SQLite's `FTS5` extension. We can create a virtual table tracking `MessageTable` contents. 
  *Query:* When looking for relevant context, we use `MATCH` against the FTS5 table scoped to the specific `projectId`.
- **The Oracle Endpoint:** 
  Create `POST /project/:projectId/oracle`. 
- **Context Assembly:** 
  When the endpoint receives a prompt:
  1. It executes the FTS5 search using the user's prompt to find the top `N` most relevant historical message blocks in that project.
  2. It formats these blocks: *"Here is relevant past context from the user's workspace..."*
  3. It injects this context into the system prompt for the LLM.
- **Stateless Execution:** 
  Similar to the "Frozen Mode" implementation, the LLM generation loop (e.g., `oracleStep`) runs in-memory. It streams `MessageV2.Part` deltas back to the client but *completely skips* inserting `MessageTable` and `PartTable` records into the database.

### 3. The "Off-Ramp" (Promote to Session)
Because the Project Oracle is stateless, we prevent database bloat from single-turn questions (e.g., "Where did we leave off on the auth refactor?"). However, if the AI provides a deep, actionable response and the user wishes to follow up, they need an escape hatch.

- **The Action:** The `<EphemeralCard>` will feature a primary action button: `[Continue in new Session]`.
- **The Implementation:** Clicking this button sends a request to a new endpoint (or standard session creation with a payload). The backend takes the original prompt and the complete aggregated AI response, performs the standard `db.insert` into `SessionTable` and `MessageTable`, and returns the new `sessionId`.
- **The Transition:** The frontend receives the new ID and smoothly transitions the router from `/project/:id/hub` to `/session/:newSessionId`, placing the user in standard, durable chat mode.

## Future Considerations
- **Global Tool Access:** Initially, the Project Oracle relies purely on chat history via FTS5. In the future, the Oracle could be granted read-only tool access (e.g., `glob`, `read`) to scan the live codebase if the answer cannot be found in the historical chat context.
- **Vector Search:** If the team eventually migrates to a local vector store or implements local embeddings, the FTS5 keyword matching can be upgraded to semantic search for significantly higher quality context retrieval.