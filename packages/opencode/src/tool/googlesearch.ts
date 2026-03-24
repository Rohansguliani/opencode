import z from "zod"
import { Auth } from "../auth"
import { Config } from "../config/config"
import { abortAfterAny } from "../util/abort"
import { Tool } from "./tool"

type Chunk = {
  web?: {
    title?: string
    uri?: string
  }
}

type Grounding = {
  groundingChunks?: Chunk[]
}

type Response = {
  candidates?: {
    content?: {
      parts?: {
        text?: string
      }[]
    }
    groundingMetadata?: Grounding
  }[]
  error?: {
    message?: string
  }
}

export const GoogleSearchTool = Tool.define("googlesearch", {
  description: "Perform a live Google search with Gemini grounding and return the answer with cited sources.",
  parameters: z.object({
    query: z.string().describe("The search query to ask Google."),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "websearch",
      patterns: [params.query],
      always: ["*"],
      metadata: { query: params.query },
    })

    const auth = await Auth.get("google")
    const cfg = await Config.get()
    const key = auth?.type === "api" ? auth.key : cfg.provider?.google?.options?.apiKey
    if (!key) throw new Error("No Gemini API key found. Run `opencode auth google`.")

    const { signal, clearTimeout } = abortAfterAny(30_000, ctx.abort)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: params.query }],
            },
          ],
          tools: [{ google_search: {} }],
        }),
        signal,
      },
    )
    clearTimeout()

    const json = (await res.json()) as Response
    if (!res.ok) throw new Error(json.error?.message || `Google search failed with status ${res.status}`)

    const candidate = json.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text || "No summary response received."
    const grounding = candidate?.groundingMetadata
    const sources = grounding?.groundingChunks
      ?.flatMap((chunk) => {
        if (!chunk.web?.uri) return []
        return [`- [${chunk.web.title || "Web Link"}](${chunk.web.uri})`]
      })
      .join("\n")

    return {
      title: `Google search: ${params.query}`,
      output: sources ? `${text}\n\n**Sources:**\n${sources}` : text,
      metadata: { grounding },
    }
  },
})
