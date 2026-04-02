import { createEffect, createMemo } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useServer } from "@/context/server"

const KEY = "opencode:pinned-sessions:v2"

function loadPinned(): Record<string, string[]> {
  try {
    const data = localStorage.getItem(KEY)
    if (data) return JSON.parse(data)
  } catch (err) {}
  return {}
}

const [pinnedState, setPinnedState] = createStore<Record<string, string[]>>(loadPinned())

createEffect(() => {
  localStorage.setItem(KEY, JSON.stringify(pinnedState))
})

export function usePinnedSessions() {
  const server = useServer()

  const pinnedSet = createMemo(() => new Set(pinnedState[server.key] || []))

  const isPinned = (sessionId: string) => pinnedSet().has(sessionId)

  const togglePinned = (sessionId: string) => {
    setPinnedState(
      produce((draft) => {
        if (!draft[server.key]) draft[server.key] = []
        const list = draft[server.key]
        const idx = list.indexOf(sessionId)
        if (idx !== -1) {
          list.splice(idx, 1)
        } else {
          list.push(sessionId)
        }
      }),
    )
  }

  const partition = <T extends { id: string }>(items: T[]) => {
    const set = pinnedSet()
    const pinned: T[] = []
    const unpinned: T[] = []
    for (const item of items) {
      if (set.has(item.id)) pinned.push(item)
      else unpinned.push(item)
    }
    return [pinned, unpinned] as const
  }

  return { pinnedSet, isPinned, togglePinned, partition }
}
