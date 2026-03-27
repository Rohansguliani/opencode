# Combined View

## The Idea
Add a `Combined View` toggle alongside the existing layout controls.

When enabled, the app should stop feeling like separate per-workspace sidebars and instead behave like one global chat browser.

## Goal
- show one unified sidebar
- render workspaces as top-level groups/folders
- render chats for each workspace inside that group
- make navigation feel global rather than workspace-isolated
- preserve existing session routes and main-pane behavior when a chat is opened

## Expected UX
- `Combined View` appears next to the existing view toggles
- when off, current workspace-separated behavior remains unchanged
- when on, the sidebar shows all workspaces in one tree
- selecting a chat still opens the right workspace/session in the main pane
- workspace grouping should stay obvious so users always know which chat belongs to which workspace

## Notes To Refine During Development
- how combined view coexists with grid mode and niri mode
- whether workspace expand/collapse state is shared or separate in combined view
- whether new session actions are scoped to a workspace group or become global
- what active-state and unread-state behavior should look like in the unified tree

## Current Implementation Notes

### Frontend
- Combined view state lives in `layout.sidebar.combinedMode()` in `packages/app/src/context/layout.tsx`.
- The titlebar now exposes a `Combined View` toggle next to `Grid Mode` and `Niri Mode` in `packages/app/src/components/titlebar.tsx`.
- When combined view is enabled, desktop sidebar collapse behaves like a true hidden sidebar instead of keeping the project avatar rail visible.

### Sidebar Behavior
- Combined view uses a dedicated unified sidebar in `packages/app/src/pages/layout/sidebar-combined.tsx`.
- The project avatar rail is hidden in combined view.
- The `ProjectHeader` wrapper is completely removed, resulting in a flat list of `WorkspaceItem` folders, perfectly mirroring the requested "Workspace Name -> Chats" structure.
- Workspace folders in combined view use the project name (if local root) or branch name, plus the directory path underneath, without the `local:` / `sandbox:` label treatment.
- Each workspace folder keeps an explicit `+` action so new chats can be created directly under that workspace.
- Workspace folders in combined view omit all borders and box backgrounds, ensuring a seamless, standard tree-like UI, with nested chats cleanly indented underneath.
- Projects are draggable! Using `SortableProvider` and `DragDropProvider`, the workspace folders can be reordered via drag-and-drop. Since workspaces map directly from the project list, dragging a project's workspace folder transparently reorders the underlying project.

### Navigation Semantics
- Combined view broadens visible sidebar session scope from the current project to all open workspace directories.
- Selecting a chat still navigates to the correct workspace/session route in the main pane.
- Existing workspace expansion state is reused so active workspaces still auto-open when navigated to.
- Combined view skips the old auto-collapse guard that was designed for per-project workspace mode, so closed folders can be reopened normally.
