import z from "zod"
import { fn } from "@opencode-ai/util/fn"
import { Database, eq } from "@/storage/db"
import { ActorContext } from "@/server/actor-context"
import { WorkspaceStateTable } from "./workspace-state.sql"

export namespace WorkspaceState {
  export const Project = z.object({
    worktree: z.string(),
    expanded: z.boolean(),
    name: z.string().optional(),
  })

  export const Page = z.object({
    activeProject: z.string().optional(),
    activeWorkspace: z.string().optional(),
    favorites: z.array(z.string()),
    workspaceOrder: z.record(z.string(), z.array(z.string())),
    workspaceName: z.record(z.string(), z.string()),
    workspaceBranchName: z.record(z.string(), z.record(z.string(), z.string())),
    workspaceExpanded: z.record(z.string(), z.boolean()),
  })

  export const Info = z
    .object({
      actor: z.string(),
      projects: z.array(Project),
      lastProject: z.string().optional(),
      page: Page,
      time: z.object({ updated: z.number() }),
    })
    .meta({ ref: "WorkspaceState" })

  const Input = Info.omit({ actor: true, time: true })

  function emptyPage() {
    return {
      activeProject: undefined,
      activeWorkspace: undefined,
      favorites: [],
      workspaceOrder: {},
      workspaceName: {},
      workspaceBranchName: {},
      workspaceExpanded: {},
    }
  }

  function fromRow(row: typeof WorkspaceStateTable.$inferSelect) {
    return {
      actor: row.actor,
      projects: row.projects,
      lastProject: row.last_project ?? undefined,
      page: {
        ...emptyPage(),
        ...row.page,
        favorites: row.page.favorites ?? [],
      },
      time: { updated: row.time_updated },
    }
  }

  export function get(actor = ActorContext.id) {
    const row = Database.use((db) => db.select().from(WorkspaceStateTable).where(eq(WorkspaceStateTable.actor, actor)).get())
    if (!row) return
    return fromRow(row)
  }

  export const put = fn(Input, async (input) => {
    const actor = ActorContext.id
    const time = Date.now()
    Database.use((db) =>
      db
        .insert(WorkspaceStateTable)
        .values({
          actor,
          projects: input.projects,
          last_project: input.lastProject,
          page: input.page,
          time_updated: time,
        })
        .onConflictDoUpdate({
          target: WorkspaceStateTable.actor,
          set: {
            projects: input.projects,
            last_project: input.lastProject,
            page: input.page,
            time_updated: time,
          },
        })
        .run(),
    )
    return {
      actor,
      projects: input.projects,
      lastProject: input.lastProject,
      page: input.page,
      time: { updated: time },
    }
  })

  export function empty() {
    return {
      actor: ActorContext.id,
      projects: [],
      lastProject: undefined,
      page: emptyPage(),
      time: { updated: 0 },
    }
  }
}
