import type { Message, Part } from "@opencode-ai/sdk/v2/client"
import type { ServerConnection } from "@/context/server"

type Model = {
  providerID: string
  modelID: string
}

type Input = {
  sessionID: string
  messageID: string
  agent: string
  model: Model
  variant?: string
  ephemeral?: boolean
  frozen?: boolean
  parts: Array<Record<string, unknown>>
}

type Output = {
  info: Message
  parts: Part[]
}

function auth(server: ServerConnection.HttpBase) {
  const headers = new Headers()
  if (server.password) headers.set("Authorization", `Basic ${btoa(`${server.username ?? "opencode"}:${server.password}`)}`)
  return headers
}

export async function promptOracle(input: {
  server: ServerConnection.HttpBase
  fetch?: typeof window.fetch
  body: Input
}) {
  const use = input.fetch ?? fetch
  const res = await use(`${input.server.url}/session/${input.body.sessionID}/oracle`, {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
      ...Object.fromEntries(auth(input.server).entries()),
    }),
    body: JSON.stringify(input.body),
  })
  if (!res.ok) throw new Error(`Frozen context request failed (${res.status})`)
  return (await res.json()) as Output
}
