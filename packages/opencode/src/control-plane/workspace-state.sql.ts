import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const WorkspaceStateTable = sqliteTable("workspace_state", {
  actor: text().primaryKey(),
  projects: text({ mode: "json" }).notNull().$type<{ worktree: string; expanded: boolean; name?: string }[]>(),
  last_project: text(),
  page: text({ mode: "json" })
    .notNull()
    .$type<{
      activeProject?: string
      activeWorkspace?: string
      favorites: string[]
      workspaceOrder: Record<string, string[]>
      workspaceName: Record<string, string>
      workspaceBranchName: Record<string, Record<string, string>>
      workspaceExpanded: Record<string, boolean>
    }>(),
  time_updated: integer().notNull(),
})
