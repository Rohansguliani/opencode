# Workspace Persistence Implementation Notes

## New Server State Shape

```ts
{
  projects: Array<{ worktree: string; expanded: boolean; name?: string }>
  lastProject?: string
  page: {
    activeProject?: string
    activeWorkspace?: string
    workspaceOrder: Record<string, string[]>
    workspaceName: Record<string, string>
    workspaceBranchName: Record<string, Record<string, string>>
    workspaceExpanded: Record<string, boolean>
  }
}
```

## Why These Fields

- `projects` restores the open top-level workspace list
- `lastProject` preserves the most recent project focus behavior
- `activeProject` / `activeWorkspace` keep workspace context aligned
- `workspaceOrder` and `workspaceExpanded` preserve organization
- `workspaceName` and `workspaceBranchName` preserve user naming choices

## Sync Rules

- server state wins when present
- local state seeds the server only when the server has no saved workspace state yet
- writes are debounced so opening/reordering multiple workspaces does not spam the backend

## Known Follow-Ups

- multi-window conflict resolution is still last-write-wins
- if richer user identity becomes available later, actor resolution should move there
- eventual SSE-based workspace-state fanout could keep multiple clients in sync live
