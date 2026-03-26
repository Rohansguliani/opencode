# Oracle Mode / Context Freezing

## The Idea
When working with coding agents in OpenCode, an agent will sometimes hit "peak performance" where it "just gets it" and perfectly understands the codebase and what you are trying to do. As you continue to chat, the context window fills up, degrades, or gets distracted by new tasks, losing that peak state.

The immediate goal is to build an **Oracle Mode toggle** (a "Freeze Context" button) in existing chats. 

### How it works:
1. When toggled **ON**, the user's current chat context is "frozen."
2. Any new message sent by the user uses the frozen chat history + the new input to query the LLM.
3. Crucially, **neither the user's new input nor the LLM's response are appended to the permanent chat history**.
4. This allows the user to ask high-confidence ad-hoc questions ("what does this file do?", "remind me how our auth works") without diluting the core, high-performing prompt context for future tasks.

---

## Technical Implementation Strategy in OpenCode

## Current Implementation Notes

### 1. Frontend State & UI (`packages/app`, `packages/ui`)
- **Toggle State**: Frozen mode is stored per session in `packages/app/src/components/prompt-input.tsx` using persisted composer state.
- **UI Toggle**: The prompt composer includes a snowflake toggle button in `packages/app/src/components/prompt-input.tsx`.
- **Submit Flow**: Frozen submits in `packages/app/src/components/prompt-input/submit.ts` call the oracle endpoint through `packages/app/src/utils/oracle.ts` instead of `promptAsync`.
- **Timeline Rendering**: Frozen turns are kept in a frontend-only overlay via `sync.session.frozen` in `packages/app/src/context/sync.tsx`. They remain visible in the chat flow even after switching chats or sending later non-frozen prompts.
- **Visual Labeling**: Both frozen user turns and frozen assistant replies render a blue snowflake indicator in `packages/ui/src/components/message-part.tsx`.

### 2. Backend API Changes (`packages/opencode`)
- **Prompt Input Flags**: `SessionPrompt.PromptInput` now accepts `ephemeral` and `frozen` flags.
- **Oracle Endpoint**: `POST /:sessionID/oracle` in `packages/opencode/src/server/routes/session.ts` runs a stateless frozen query and returns an assistant message payload without persisting the turn.
- **No DB Persistence**: `packages/opencode/src/session/prompt.ts` builds the frozen user/assistant turn in memory only when `ephemeral` is set.
- **Context Exclusion**: Frozen turns are tagged with `metadata.frozen = true`, and `packages/opencode/src/session/message-v2.ts` filters them out of future model context unless the currently executing frozen turn explicitly includes itself.
- **Read-Only Intent**: Oracle mode resolves tools through a read-only allowlist so frozen prompts behave like scratchpad questions rather than mutation requests.

### 3. Behavior Guarantees
- **Visible But Stateless**: Frozen turns show up in the frontend timeline, but they are not appended to the session's persisted history.
- **No Context Pollution**: Future normal prompts do not include prior frozen turns in LLM context.
- **Explicit Provenance**: Frozen turns are visually marked so users can distinguish scratchpad Q&A from durable conversation history.

### 1. Frontend State & UI (`packages/app`)
- **Toggle State**: Introduce an `isFrozen` (or `oracleMode`) boolean state. This could be stored in the session composer state (`packages/app/src/pages/session/composer/session-composer-state.ts`) or within the `usePrompt` context.
- **UI Toggle**: Add a "❄️ Freeze Context" toggle button either in the `SessionHeader` (`session-header.tsx`) or directly inside/above the `PromptInput` (`prompt-input.tsx`). 
- **Submit Logic**: In `packages/app/src/components/prompt-input/submit.ts`, when `handleSubmit` is triggered and `isFrozen` is true:
  - **Bypass Optimistic Sync**: Do not call `sync.session.optimistic.add(...)`.
  - **Stateless Request**: Instead of `client.session.promptAsync` (which assumes permanent storage and relies on global sync events to render), we will use a different endpoint or a modified payload (e.g., `client.session.oracle(...)`) that streams back a transient response.
- **Rendering the Response**: Since the response won't be saved to the database (and thus won't trigger `globalSync` updates via the Event Bus), we need a transient UI state (e.g., an `<EphemeralMessage>` component rendered below the composer) to display the streamed parts.

### 2. Backend API Changes (`packages/opencode`)
- **New Schema**: Update `SessionPrompt.PromptInput` in `packages/opencode/src/session/prompt.ts` to accept a boolean flag (e.g., `ephemeral: z.boolean().optional()`).
- **Bypassing Database Insertion**: 
  - Inside `SessionPrompt.prompt` (or a dedicated `oracle` function), when `ephemeral` is true:
    - **Skip `createUserMessage` DB insert**: Construct the `MessageV2.Info` in memory but do not call `db.insert(MessageTable)`.
    - **Skip Assistant Part DB inserts**: During the LLM `loop`, do not write the resulting assistant parts (like `updatePart` or `updateMessage`) to the DB.
    - **In-Memory Context**: Gather the prior messages using `MessageV2.stream(sessionID)`, append the ephemeral user message to the array in memory, and pass that to the LLM `generate` loop.
- **Streaming the Output**: 
  - If we use the existing `POST /:sessionID/message` endpoint (which returns a stream), we can just pipe the LLM's generated `MessageV2.Part` deltas directly back to the HTTP response stream without persisting them.
  - Alternatively, create a dedicated `POST /:sessionID/oracle` endpoint in `server/routes/session.ts` to clearly separate permanent conversational prompts from stateless queries.

### 3. Edge Cases & Considerations
- **Tools / Actions in Oracle Mode**: If the agent uses tools (like `edit` or `bash`) while frozen, does it actually execute them? Ideally, Oracle Mode should be strictly "read-only" (answering questions) or restricted to read tools (`ReadTool`, `Glob`, `Grep`) to prevent unintended state mutations while the context is frozen.
- **Context Revert**: We must ensure that the "frozen" state doesn't accidentally trigger a `SessionRevert.cleanup` or compaction that alters the database state of the underlying session.
- **UI Persistence**: The final behavior is not to hide frozen turns when frozen mode is toggled off or when the user switches chats. They should stay visible in the timeline for that session, but remain excluded from future prompt context.
