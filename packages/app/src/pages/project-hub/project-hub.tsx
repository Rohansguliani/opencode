import { createSignal, createMemo, Show, For, onCleanup } from "solid-js"
import { useParams, useNavigate } from "@solidjs/router"
import { useGlobalSync } from "@/context/global-sync"
import { decode64 } from "@/utils/base64"
import { sortedRootSessions } from "../layout/helpers"
import { Card } from "@opencode-ai/ui/card"
import { Button } from "@opencode-ai/ui/button"
import { TextField } from "@opencode-ai/ui/text-field"
import { useSDK } from "@/context/sdk"
import { Markdown } from "@opencode-ai/ui/markdown"
import { base64Encode } from "@opencode-ai/util/encode"
import { ServerConnection, useServer } from "@/context/server"

function auth(server: ServerConnection.HttpBase) {
  const headers = new Headers()
  if (server.password) headers.set("Authorization", `Basic ${btoa(`${server.username ?? "opencode"}:${server.password}`)}`)
  return headers
}

export default function ProjectHub() {
  const params = useParams()
  const navigate = useNavigate()
  const globalSync = useGlobalSync()
  const serverCtx = useServer()
  
  const directory = createMemo(() => decode64(params.dir) ?? "")
  const [store] = globalSync.child(directory(), { bootstrap: true })
  const sessions = createMemo(() => sortedRootSessions(store))
  
  const [query, setQuery] = createSignal("")
  const [submittedQuery, setSubmittedQuery] = createSignal("")
  const [ephemeralResponse, setEphemeralResponse] = createSignal("")
  const [isStreaming, setIsStreaming] = createSignal(false)
  
  const filteredSessions = createMemo(() => {
    const q = query().toLowerCase()
    if (!q) return sessions()
    return sessions().filter(s => (s.title || "New Session").toLowerCase().includes(q))
  })
  
  let abortController: AbortController | null = null

  const submitPrompt = async () => {
    const prompt = query().trim()
    if (!prompt) return
    
    setSubmittedQuery(prompt)
    setQuery("")
    setEphemeralResponse("")
    setIsStreaming(true)
    
    if (abortController) abortController.abort()
    abortController = new AbortController()

    try {
      const server = serverCtx.current
      if (!server || server.type !== "http") throw new Error("No HTTP server connection")
      
      const projectId = store.project
      if (!projectId) throw new Error("No Project ID found")

      const res = await fetch(`${server.http.url}/project/${projectId}/oracle`, {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...Object.fromEntries(auth(server.http).entries()),
        }),
        body: JSON.stringify({ prompt }),
        signal: abortController.signal
      })

      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      
      if (reader) {
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === "reasoning-delta" || data.type === "text-delta") {
                  setEphemeralResponse(prev => prev + data.text)
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Oracle error:", err)
        setEphemeralResponse(prev => prev + "\n\n[Error communicating with Oracle]")
      }
    } finally {
      setIsStreaming(false)
    }
  }

  const promoteToSession = async () => {
    const server = serverCtx.current
    if (!server || server.type !== "http") return

    try {
      const projectId = store.project
      if (!projectId) return

      const res = await fetch(`${server.http.url}/project/${projectId}/promote`, {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
          Accept: "application/json",
          ...Object.fromEntries(auth(server.http).entries()),
        }),
        body: JSON.stringify({
          prompt: submittedQuery(),
          response: ephemeralResponse(),
        }),
      })

      if (!res.ok) throw new Error("Promote failed")
      
      const { sessionID } = await res.json()
      
      navigate(`/${params.dir}/session/${sessionID}`)
    } catch (e) {
      console.error(e)
    }
  }

  onCleanup(() => {
    if (abortController) abortController.abort()
  })
  
  return (
    <div class="flex flex-col size-full bg-background-base overflow-y-auto items-center p-8 gap-8">
      <div class="w-full max-w-3xl flex flex-col gap-6">
        <div class="text-24-medium text-text-strong">
          Project Hub
        </div>
        
        <div class="w-full">
          <TextField
            value={query()}
            onChange={setQuery}
            placeholder="Ask the project oracle, or search past sessions..."
            class="w-full text-16-regular"
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submitPrompt()
              }
            }}
          />
        </div>
        
        <Show when={submittedQuery()}>
          <Card class="p-6 flex flex-col gap-4 border-2 border-border-strong-base shadow-sm">
            <div class="text-16-medium text-text-strong">
              {submittedQuery()}
            </div>
            <div class="text-14-regular text-text-base">
              <Markdown text={ephemeralResponse() || (isStreaming() ? "..." : "")} />
            </div>
            <Show when={!isStreaming()}>
              <div class="flex justify-end pt-2">
                <Button onClick={promoteToSession} variant="primary">
                  Continue in new Session
                </Button>
              </div>
            </Show>
          </Card>
        </Show>

        <Show when={!submittedQuery()}>
          <div class="flex flex-col gap-4">
            <div class="text-14-medium text-text-weak uppercase tracking-wider">
              Past Sessions
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <For each={filteredSessions()}>
                {(session) => (
                  <Card 
                    class="p-4 flex flex-col gap-2 cursor-pointer hover:bg-surface-raised-base-hover transition-colors"
                    onClick={() => navigate(`/${params.dir}/session/${session.id}`)}
                  >
                    <div class="text-14-medium text-text-strong truncate">
                      {session.title || "New Session"}
                    </div>
                    <div class="text-12-regular text-text-weak truncate">
                      {new Date(session.time.created).toLocaleDateString()}
                    </div>
                  </Card>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
