export function splitWorkspace(dir: string | undefined) {
  if (!dir) return { root: "", id: undefined as string | undefined }
  let decoded = dir
  try {
    decoded = decodeURIComponent(dir)
  } catch (e) {
    // leave as is
  }
  const [root, id] = decoded.split("?workspace=")
  return { root, id: id || undefined }
}

export function joinWorkspace(root: string, id?: string) {
  if (!id) return root
  return `${root}?workspace=${id}`
}

export function stripWorkspace(dir: string | undefined) {
  return splitWorkspace(dir).root
}
