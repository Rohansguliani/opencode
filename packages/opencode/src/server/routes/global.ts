import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { streamSSE } from "hono/streaming"
import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Instance } from "../../project/instance"
import { Installation } from "@/installation"
import { Log } from "../../util/log"
import { lazy } from "../../util/lazy"
import { Config } from "../../config/config"
import { errors } from "../error"
import { WorkspaceState } from "../../control-plane/workspace-state"
import { db } from "../../storage/simple-db"

const log = Log.create({ service: "server" })

export const GlobalDisposedEvent = BusEvent.define("global.disposed", z.object({}))

export const GlobalRoutes = lazy(() =>
  new Hono()
    .get(
      "/health",
      describeRoute({
        summary: "Get health",
        description: "Get health information about the OpenCode server.",
        operationId: "global.health",
        responses: {
          200: {
            description: "Health information",
            content: {
              "application/json": {
                schema: resolver(z.object({ healthy: z.literal(true), version: z.string() })),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({ healthy: true, version: Installation.VERSION })
      },
    )
    .get(
      "/event",
      describeRoute({
        summary: "Get global events",
        description: "Subscribe to global events from the OpenCode system using server-sent events.",
        operationId: "global.event",
        responses: {
          200: {
            description: "Event stream",
            content: {
              "text/event-stream": {
                schema: resolver(
                  z
                    .object({
                      directory: z.string(),
                      payload: BusEvent.payloads(),
                    })
                    .meta({
                      ref: "GlobalEvent",
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        log.info("global event connected")
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamSSE(c, async (stream) => {
          stream.writeSSE({
            data: JSON.stringify({
              payload: {
                type: "server.connected",
                properties: {},
              },
            }),
          })
          async function handler(event: any) {
            await stream.writeSSE({
              data: JSON.stringify(event),
            })
          }
          GlobalBus.on("event", handler)

          // Send heartbeat every 10s to prevent stalled proxy streams.
          const heartbeat = setInterval(() => {
            stream.writeSSE({
              data: JSON.stringify({
                payload: {
                  type: "server.heartbeat",
                  properties: {},
                },
              }),
            })
          }, 10_000)

          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              clearInterval(heartbeat)
              GlobalBus.off("event", handler)
              resolve()
              log.info("global event disconnected")
            })
          })
        })
      },
    )
    .get(
      "/config",
      describeRoute({
        summary: "Get global configuration",
        description: "Retrieve the current global OpenCode configuration settings and preferences.",
        operationId: "global.config.get",
        responses: {
          200: {
            description: "Get global config info",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Config.getGlobal())
      },
    )
    .patch(
      "/config",
      describeRoute({
        summary: "Update global configuration",
        description: "Update global OpenCode configuration settings and preferences.",
        operationId: "global.config.update",
        responses: {
          200: {
            description: "Successfully updated global config",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Config.Info),
      async (c) => {
        const config = c.req.valid("json")
        const next = await Config.updateGlobal(config)
        return c.json(next)
      },
    )
    .get(
      "/workspace-state",
      describeRoute({
        summary: "Get workspace state",
        description: "Retrieve persisted workspace UI state for the current user on this server.",
        operationId: "global.workspaceState.get",
        responses: {
          200: {
            description: "Workspace state",
            content: {
              "application/json": {
                schema: resolver(WorkspaceState.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        try {
          const row = db.prepare('SELECT * FROM workspace_state WHERE actor = ?').get('default') as any
          if (row) {
            return c.json({
              projects: JSON.parse(row.projects),
              last_project: row.last_project,
              page: JSON.parse(row.page),
              time_updated: row.time_updated,
            })
          }
          return c.json({ projects: [], page: { favorites: [], workspaceOrder: {}, workspaceName: {}, workspaceBranchName: {}, workspaceExpanded: {} }, time_updated: Date.now() })
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .patch(
      "/workspace-state",
      describeRoute({
        summary: "Update workspace state",
        description: "Persist workspace UI state for the current user on this server.",
        operationId: "global.workspaceState.update",
        responses: {
          200: {
            description: "Workspace state",
            content: {
              "application/json": {
                schema: resolver(WorkspaceState.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", WorkspaceState.Info.omit({ actor: true, time: true })),
      async (c) => {
        const body = c.req.valid("json")
        const projects = JSON.stringify(body.projects || [])
        const last_project = body.last_project || null
        const page = JSON.stringify(body.page || {})
        const time_updated = Date.now()
        
        try {
          db.prepare(`
            INSERT INTO workspace_state (actor, projects, last_project, page, time_updated)
            VALUES ('default', ?, ?, ?, ?)
            ON CONFLICT(actor) DO UPDATE SET
              projects = excluded.projects,
              last_project = excluded.last_project,
              page = excluded.page,
              time_updated = excluded.time_updated
          `).run(projects, last_project, page, time_updated)
          
          return c.json({ ...body, actor: 'default', time_updated })
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .post(
      "/dispose",
      describeRoute({
        summary: "Dispose instance",
        description: "Clean up and dispose all OpenCode instances, releasing all resources.",
        operationId: "global.dispose",
        responses: {
          200: {
            description: "Global disposed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Instance.disposeAll()
        GlobalBus.emit("event", {
          directory: "global",
          payload: {
            type: GlobalDisposedEvent.type,
            properties: {},
          },
        })
        return c.json(true)
      },
    ),
)
