import { getFilename } from "./path"

export function splitWorkspace(dir: string | undefined) {
  if (!dir) return { root: "", id: undefined as string | undefined }
  const [root, id] = dir.split("?workspace=")
  return { root, id: id || undefined }
}

export function joinWorkspace(root: string, id?: string) {
  if (!id) return root
  return `${root}?workspace=${id}`
}

export function stripWorkspace(dir: string | undefined) {
  return splitWorkspace(dir).root
}

export function workspaceTitle(dir: string | undefined, fallback = "") {
  return getFilename(stripWorkspace(dir)) || fallback
}
