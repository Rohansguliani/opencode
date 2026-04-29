import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Workspace } from "../../control-plane/workspace"
import { Instance } from "../../project/instance"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { db } from "../../storage/simple-db"

export const WorkspaceRoutes = lazy(() =>
  new Hono()
    .post(
      "/",
      describeRoute({
        summary: "Create workspace",
        description: "Create a workspace for the current project.",
        operationId: "experimental.workspace.create",
        responses: {
          200: {
            description: "Workspace created",
            content: {
              "application/json": {
                schema: resolver(Workspace.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        Workspace.create.schema.omit({
          projectID: true,
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const name = body.name || body.directory.split('/').pop() || "New Workspace"
        try {
          const existing = db.prepare('SELECT * FROM workspaces WHERE directory = ?').get(body.directory) as any
          if (existing) {
            return c.json({
              id: existing.id,
              name: existing.name,
              directory: existing.directory,
              time: { created: Date.now(), updated: Date.now() },
              sandboxes: [],
            })
          }

          const id = Math.random().toString(36).substring(2, 11)
          db.prepare('INSERT INTO workspaces (id, name, directory) VALUES (?, ?, ?)').run(id, name, body.directory)
          return c.json({
            id,
            name,
            directory: body.directory,
            time: { created: Date.now(), updated: Date.now() },
            sandboxes: [],
          })
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List workspaces",
        description: "List all workspaces.",
        operationId: "experimental.workspace.list",
        responses: {
          200: {
            description: "Workspaces",
            content: {
              "application/json": {
                schema: resolver(z.array(Workspace.Info)),
              },
            },
          },
        },
      }),
      async (c) => {
        const rows = db.prepare('SELECT * FROM workspaces').all() as any[]
        return c.json(rows.map(row => ({
          id: row.id,
          name: row.name,
          directory: row.directory,
          time: { created: Date.now(), updated: Date.now() },
          sandboxes: [],
        })))
      },
    )
    .delete(
      "/:id",
      describeRoute({
        summary: "Remove workspace",
        description: "Remove an existing workspace.",
        operationId: "experimental.workspace.remove",
        responses: {
          200: {
            description: "Workspace removed",
            content: {
              "application/json": {
                schema: resolver(z.object({ id: z.string(), name: z.string(), directory: z.string() }).optional()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const { id } = c.req.valid("param")
        try {
          const deleted = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any
          db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
          return c.json(deleted)
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .patch(
      "/:id",
      describeRoute({
        summary: "Rename workspace",
        description: "Rename an existing workspace.",
        operationId: "experimental.workspace.rename",
        responses: {
          200: {
            description: "Workspace renamed",
            content: {
              "application/json": {
                schema: resolver(z.object({ id: z.string(), name: z.string(), directory: z.string() })),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      validator("json", z.object({ name: z.string() })),
      async (c) => {
        const { id } = c.req.valid("param")
        const { name } = c.req.valid("json")
        try {
          db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name, id)
          const updated = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any
          return c.json(updated)
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
)
