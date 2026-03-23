import { type Session } from "@opencode-ai/sdk/v2/client"
import { compareSessionRecent } from "@/context/global-sync/session-trim"
import { joinWorkspace, splitWorkspace, workspaceTitle } from "@/utils/workspace"

const updated = (session: Session) => session.time.updated ?? session.time.created

export const workspaceKey = (directory: string) => {
  const workspace = splitWorkspace(directory)
  const drive = workspace.root.match(/^([A-Za-z]:)[\\/]+$/)
  const root = drive
    ? `${drive[1]}${workspace.root.includes("\\") ? "\\" : "/"}`
    : /^[\\/]+$/.test(workspace.root)
      ? workspace.root.includes("\\") ? "\\" : "/"
      : workspace.root.replace(/[\\/]+$/, "")
  return joinWorkspace(root, workspace.id)
}

const isRootVisibleSession = (session: Session, directory: string) => {
  const workspace = splitWorkspace(directory)
  return (
    workspaceKey(session.directory) === workspaceKey(workspace.root) &&
    (session.workspaceID || undefined) === workspace.id &&
    !session.parentID &&
    !session.time?.archived
  )
}

export const sortedRootSessions = (store: { session: Session[]; path: { directory: string } }, _now: number) => {
  return store.session.filter((session) => isRootVisibleSession(session, store.path.directory)).sort(compareSessionRecent)
}

export const latestRootSession = (stores: { session: Session[]; path: { directory: string } }[], _now: number) => {
  return stores
    .flatMap((store) => store.session.filter((session) => isRootVisibleSession(session, store.path.directory)))
    .sort(compareSessionRecent)[0]
}

export const recentRootSessions = (store: { session: Session[]; path: { directory: string } }) =>
  store.session
    .filter((session) => isRootVisibleSession(session, store.path.directory))
    .sort((a, b) => updated(b) - updated(a))

export function hasProjectPermissions<T>(
  request: Record<string, T[] | undefined>,
  include: (item: T) => boolean = () => true,
) {
  return Object.values(request).some((list) => list?.some(include))
}

export const childMapByParent = (sessions: Session[]) => {
  const map = new Map<string, string[]>()
  for (const session of sessions) {
    if (!session.parentID) continue
    const existing = map.get(session.parentID)
    if (existing) {
      existing.push(session.id)
      continue
    }
    map.set(session.parentID, [session.id])
  }
  return map
}

export const displayName = (project: { name?: string; worktree: string }) => project.name || workspaceTitle(project.worktree, "Workspace")

export const errorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

export const effectiveWorkspaceOrder = (local: string, dirs: string[], persisted?: string[]) => {
  const root = workspaceKey(local)
  const live = new Map<string, string>()

  for (const dir of dirs) {
    const key = workspaceKey(dir)
    if (key === root) continue
    if (!live.has(key)) live.set(key, dir)
  }

  if (!persisted?.length) return [local, ...live.values()]

  const result = [local]
  for (const dir of persisted) {
    const key = workspaceKey(dir)
    if (key === root) continue
    const match = live.get(key)
    if (!match) continue
    result.push(match)
    live.delete(key)
  }

  return [...result, ...live.values()]
}
