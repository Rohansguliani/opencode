export type SessionMode = "grid" | "niri"

export function sessionMode(sidebar: { gridMode: () => boolean; niriMode: () => boolean }) {
  if (sidebar.gridMode()) return "grid"
  if (sidebar.niriMode()) return "niri"
}

export function sessionParam(mode: SessionMode | undefined) {
  if (mode === "grid") return "grid"
  if (mode === "niri") return "strip"
}

export function sessionValue(
  mode: SessionMode | undefined,
  searchParams: { grid?: string; strip?: string },
) {
  const key = sessionParam(mode)
  if (!key) return
  return searchParams[key]
}

export function sessionIds(
  mode: SessionMode | undefined,
  searchParams: { grid?: string; strip?: string },
  id?: string,
) {
  const value = sessionValue(mode, searchParams)
  if (value) return value.split(",")
  return id ? [id] : []
}

export function sessionQuery(mode: SessionMode | undefined, value: string | undefined) {
  const key = sessionParam(mode)
  if (!key || value === undefined) return ""
  return `?${key}=${value}`
}
