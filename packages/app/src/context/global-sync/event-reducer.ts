import { Binary } from "@opencode-ai/util/binary"
import { produce, reconcile, type SetStoreFunction, type Store } from "solid-js/store"
import type {
  FileDiff,
  Message,
  Part,
  PermissionRequest,
  Project,
  QuestionRequest,
  Session,
  SessionStatus,
  Todo,
} from "@opencode-ai/sdk/v2/client"
import type { State, VcsCache } from "./types"
import { trimSessions } from "./session-trim"
import { dropSessionCaches } from "./session-cache"

export function applyGlobalEvent(input: {
  event: { type: string; properties?: unknown }
  project: Project[]
  setGlobalProject: (next: Project[] | ((draft: Project[]) => void)) => void
  refresh: () => void
}) {
  if (input.event.type === "global.disposed" || input.event.type === "server.connected") {
    input.refresh()
    return
  }

  if (input.event.type !== "project.updated") return
  const properties = input.event.properties as Project
  const result = Binary.search(input.project, properties.id, (s) => s.id)
  if (result.found) {
    input.setGlobalProject((draft) => {
      draft[result.index] = { ...draft[result.index], ...properties }
    })
    return
  }
  input.setGlobalProject((draft) => {
    draft.splice(result.index, 0, properties)
  })
}

function cleanupSessionCaches(
  setStore: SetStoreFunction<State>,
  sessionID: string,
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void,
) {
  if (!sessionID) return
  setSessionTodo?.(sessionID, undefined)
  setStore(
    produce((draft) => {
      dropSessionCaches(draft, [sessionID])
    }),
  )
}

export function cleanupDroppedSessionCaches(
  store: Store<State>,
  setStore: SetStoreFunction<State>,
  next: Session[],
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void,
) {
  const keep = new Set(next.map((item) => item.id))
  const stale = [
    ...Object.keys(store.message),
    ...Object.keys(store.session_diff),
    ...Object.keys(store.todo),
    ...Object.keys(store.permission),
    ...Object.keys(store.question),
    ...Object.keys(store.session_status),
    ...Object.values(store.part)
      .map((parts) => parts?.find((part) => !!part?.sessionID)?.sessionID)
      .filter((sessionID): sessionID is string => !!sessionID),
  ].filter((sessionID, index, list) => !keep.has(sessionID) && list.indexOf(sessionID) === index)
  if (stale.length === 0) return
  for (const sessionID of stale) {
    setSessionTodo?.(sessionID, undefined)
  }
  setStore(
    produce((draft) => {
      dropSessionCaches(draft, stale)
    }),
  )
}

export function applyDirectoryEvent(input: {
  event: { type: string; properties?: unknown }
  store: Store<State>
  setStore: SetStoreFunction<State>
  push: (directory: string) => void
  directory: string
  loadLsp: () => void
  vcsCache?: VcsCache
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void
}) {
  const event = input.event
  switch (event.type) {
    case "server.instance.disposed": {
      input.push(input.directory)
      return
    }
    case "session.created": {
      const info = (event.properties as { info: Session }).info
      const sessions = input.store.session || []
      const index = sessions.findIndex((s) => s.id === info.id)
      if (index !== -1) {
        input.setStore("session", index, reconcile(info))
        break
      }
      const next = [...sessions, info].sort((a, b) => (b.time.created || 0) - (a.time.created || 0))
      const trimmed = trimSessions(next, { limit: input.store.limit, permission: input.store.permission })
      input.setStore("session", reconcile(trimmed, { key: "id" }))
      cleanupDroppedSessionCaches(input.store, input.setStore, trimmed, input.setSessionTodo)
      if (!info.parentID) input.setStore("sessionTotal", (value) => value + 1)
      break
    }
    case "session.updated": {
      const info = (event.properties as { info: Session }).info
      const sessions = input.store.session || []
      const index = sessions.findIndex((s) => s.id === info.id)
      if (info.time.archived) {
        if (index !== -1) {
          input.setStore(
            "session",
            produce((draft) => {
              draft.splice(index, 1)
            }),
          )
        }
        cleanupSessionCaches(input.setStore, info.id, input.setSessionTodo)
        if (info.parentID) break
        input.setStore("sessionTotal", (value) => Math.max(0, value - 1))
        break
      }
      if (index !== -1) {
        input.setStore("session", index, reconcile(info))
        break
      }
      const next = [...sessions, info].sort((a, b) => (b.time.created || 0) - (a.time.created || 0))
      const trimmed = trimSessions(next, { limit: input.store.limit, permission: input.store.permission })
      input.setStore("session", reconcile(trimmed, { key: "id" }))
      cleanupDroppedSessionCaches(input.store, input.setStore, trimmed, input.setSessionTodo)
      break
    }
    case "session.deleted": {
      const info = (event.properties as { info: Session }).info
      const sessions = input.store.session || []
      const index = sessions.findIndex((s) => s.id === info.id)
      if (index !== -1) {
        input.setStore(
          "session",
          produce((draft) => {
            draft.splice(index, 1)
          }),
        )
      }
      cleanupSessionCaches(input.setStore, info.id, input.setSessionTodo)
      if (info.parentID) break
      input.setStore("sessionTotal", (value) => Math.max(0, value - 1))
      break
    }
    case "session.diff": {
      const props = event.properties as { sessionID: string; diff: FileDiff[] }
      input.setStore("session_diff", props.sessionID, reconcile(props.diff, { key: "file" }))
      break
    }
    case "todo.updated": {
      const props = event.properties as { sessionID: string; todos: Todo[] }
      input.setStore("todo", props.sessionID, reconcile(props.todos, { key: "id" }))
      input.setSessionTodo?.(props.sessionID, props.todos)
      break
    }
    case "session.status": {
      const props = event.properties as { sessionID: string; status: SessionStatus }
      input.setStore("session_status", props.sessionID, reconcile(props.status))
      break
    }
    case "message.updated": {
      const info = (event.properties as { info: Message }).info
      const messages = input.store.message[info.sessionID] || []
      
      const index = messages.findIndex((m) => m.id === info.id)
      if (index !== -1) {
        input.setStore("message", info.sessionID, index, reconcile(info))
      } else {
        input.setStore("message", info.sessionID, [...messages, info])
      }
      break
    }
    case "message.removed": {
      const props = event.properties as { sessionID: string; messageID: string }
      input.setStore(
        produce((draft) => {
          const messages = draft.message[props.sessionID]
          if (messages) {
            const index = messages.findIndex((m) => m.id === props.messageID)
            if (index !== -1) messages.splice(index, 1)
          }
          delete draft.part[props.messageID]
        }),
      )
      break
    }
    case "message.part.updated": {
      const part = (event.properties as { part: Part }).part
      const parts = input.store.part[part.messageID] || []
      
      const index = parts.findIndex((p) => p.id === part.id)
      if (index !== -1) {
        input.setStore("part", part.messageID, index, reconcile(part))
      } else {
        input.setStore("part", part.messageID, [...parts, part])
      }
      break
    }
    case "message.part.removed": {
      const props = event.properties as { messageID: string; partID: string }
      const parts = input.store.part[props.messageID]
      if (!parts) break
      const result = Binary.search(parts, props.partID, (p) => p.id)
      if (result.found) {
        input.setStore(
          produce((draft) => {
            const list = draft.part[props.messageID]
            if (!list) return
            const next = Binary.search(list, props.partID, (p) => p.id)
            if (!next.found) return
            list.splice(next.index, 1)
            if (list.length === 0) delete draft.part[props.messageID]
          }),
        )
      }
      break
    }
    case "message.part.delta": {
      const props = event.properties as { messageID: string; partID: string; field: string; delta: string }
      const parts = input.store.part[props.messageID]
      if (!parts) break
      const index = parts.findIndex((p) => p.id === props.partID)
      if (index === -1) break
      input.setStore(
        "part",
        props.messageID,
        produce((draft) => {
          const part = draft[index]
          const field = props.field as keyof typeof part
          const existing = part[field] as string | undefined
          ;(part[field] as string) = (existing ?? "") + props.delta
        }),
      )
      break
    }
    case "vcs.branch.updated": {
      const props = event.properties as { branch: string }
      if (input.store.vcs?.branch === props.branch) break
      const next = { branch: props.branch }
      input.setStore("vcs", next)
      if (input.vcsCache) input.vcsCache.setStore("value", next)
      break
    }
    case "permission.asked": {
      const permission = event.properties as PermissionRequest
      const permissions = input.store.permission[permission.sessionID] || []
      
      const index = permissions.findIndex((p) => p.id === permission.id)
      if (index !== -1) {
        input.setStore("permission", permission.sessionID, index, reconcile(permission))
      } else {
        input.setStore("permission", permission.sessionID, [...permissions, permission])
      }
      break
    }
    case "permission.replied": {
      const props = event.properties as { sessionID: string; requestID: string }
      const permissions = input.store.permission[props.sessionID] || []
      
      const index = permissions.findIndex((p) => p.id === props.requestID)
      if (index !== -1) {
        input.setStore(
          "permission",
          props.sessionID,
          produce((draft) => {
            draft.splice(index, 1)
          }),
        )
      }
      break
    }
    case "question.asked": {
      const question = event.properties as QuestionRequest
      const questions = input.store.question[question.sessionID] || []
      
      const index = questions.findIndex((q) => q.id === question.id)
      if (index !== -1) {
        input.setStore("question", question.sessionID, index, reconcile(question))
      } else {
        input.setStore("question", question.sessionID, [...questions, question])
      }
      break
    }
    case "question.replied":
    case "question.rejected": {
      const props = event.properties as { sessionID: string; requestID: string }
      const questions = input.store.question[props.sessionID] || []
      
      const index = questions.findIndex((q) => q.id === props.requestID)
      if (index !== -1) {
        input.setStore(
          "question",
          props.sessionID,
          produce((draft) => {
            draft.splice(index, 1)
          }),
        )
      }
      break
    }
    case "lsp.updated": {
      input.loadLsp()
      break
    }
  }
}
