import type { ServerConnection, StoredProject } from "@/context/server"

export type WorkspacePageState = {
  activeProject: string | undefined
  activeWorkspace: string | undefined
  favorites: string[]
  workspaceOrder: Record<string, string[]>
  workspaceName: Record<string, string>
  workspaceBranchName: Record<string, Record<string, string>>
  workspaceExpanded: Record<string, boolean>
}

export type WorkspaceState = {
  actor: string
  projects: StoredProject[]
  lastProject?: string
  page: WorkspacePageState
  time: { updated: number }
}

function auth(server: ServerConnection.HttpBase) {
  const headers = new Headers()
  if (server.password) headers.set("Authorization", `Basic ${btoa(`${server.username ?? "opencode"}:${server.password}`)}`)
  return headers
}

export async function getWorkspaceState(server: ServerConnection.HttpBase, custom?: typeof fetch) {
  const use = custom ?? fetch
  const res = await use(`${server.url}/global/workspace-state`, {
    headers: {
      Accept: "application/json",
      ...Object.fromEntries(auth(server).entries()),
    },
  })
  if (!res.ok) throw new Error(`Failed to load workspace state (${res.status})`)
  return (await res.json()) as WorkspaceState
}

export async function putWorkspaceState(server: ServerConnection.HttpBase, state: Omit<WorkspaceState, "actor" | "time">, custom?: typeof fetch) {
  const use = custom ?? fetch
  const res = await use(`${server.url}/global/workspace-state`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...Object.fromEntries(auth(server).entries()),
    },
    body: JSON.stringify(state),
  })
  if (!res.ok) throw new Error(`Failed to save workspace state (${res.status})`)
  return (await res.json()) as WorkspaceState
}
