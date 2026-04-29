import { Hono } from "hono"
import { Instance } from "../../project/instance"
import { stream } from "hono/streaming"
import { describeRoute, validator, resolver } from "hono-openapi"
import { SessionID, MessageID, PartID } from "@/session/schema"
import z from "zod"
import { Session } from "../../session"
import { MessageV2 } from "../../session/message-v2"
import { SessionPrompt } from "../../session/prompt"
import { SessionCompaction } from "../../session/compaction"
import { SessionRevert } from "../../session/revert"
import { SessionStatus } from "@/session/status"
import { SessionSummary } from "@/session/summary"
import { Todo } from "../../session/todo"
import { Agent } from "../../agent/agent"
import { Provider } from "../../provider/provider"
import { SessionProcessor } from "../../session/processor"
import { Snapshot } from "@/snapshot"
import { Log } from "../../util/log"
import { PermissionNext } from "@/permission/next"
import { PermissionID } from "@/permission/schema"
import { ModelID, ProviderID } from "@/provider/schema"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { db } from "../../storage/simple-db"
import { Bus } from "../../bus"
import { GlobalBus } from "../../bus/global"
import { generateText, streamText } from "ai"
import { google } from "@ai-sdk/google"

const log = Log.create({ service: "server" })

export const SessionRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List sessions",
        description: "Get a list of all OpenCode sessions, sorted by most recently updated.",
        operationId: "session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          directory: z.string().optional().meta({ description: "Filter sessions by project directory" }),
          roots: z.coerce.boolean().optional().meta({ description: "Only return root sessions (no parentID)" }),
          start: z.coerce
            .number()
            .optional()
            .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
          search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
          limit: z.coerce.number().optional().meta({ description: "Maximum number of sessions to return" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        if (!query.directory) return c.json([])
        
        try {
          const [cleanDir, queryString] = query.directory.split('?')
          log.info("Listing chats for directory", { directory: cleanDir })
          let workspace = db.prepare('SELECT id FROM workspaces WHERE directory = ?').get(cleanDir) as any
          if (!workspace && queryString) {
            const parts = queryString.split('=')
            const wsId = parts[1]
            if (wsId) {
              workspace = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(wsId) as any
            }
          }
          if (!workspace) {
            workspace = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(cleanDir) as any
          }
          log.info("Found workspace in list", { workspace })
          const rows = workspace 
            ? db.prepare('SELECT * FROM simple_sessions WHERE workspace_id = ? ORDER BY time_created DESC').all(workspace.id) as any[]
            : db.prepare('SELECT * FROM simple_sessions ORDER BY time_created DESC').all() as any[]
          
          return c.json(rows.map(row => ({
            id: row.id,
            workspaceID: row.workspace_id,
            projectID: "default",
            title: row.title,
            time: { created: row.time_created, updated: row.time_created },
            directory: cleanDir,
            version: "2",
            slug: row.id,
          })))
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .get(
      "/status",
      describeRoute({
        summary: "Get session status",
        description: "Retrieve the current status of all sessions, including active, idle, and completed states.",
        operationId: "session.status",
        responses: {
          200: {
            description: "Get session status",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), SessionStatus.Info)),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        const result = SessionStatus.list()
        return c.json(result)
      },
    )
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get session",
        description: "Retrieve detailed information about a specific OpenCode session.",
        tags: ["Session"],
        operationId: "session.get",
        responses: {
          200: {
            description: "Get session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.get.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        try {
          const row = db.prepare(`
            SELECT s.*, w.directory 
            FROM simple_sessions s 
            JOIN workspaces w ON s.workspace_id = w.id 
            WHERE s.id = ?
          `).get(sessionID) as any
          
          if (!row) return c.json({ error: "Session not found" }, 404)
          
          return c.json({
            id: row.id,
            workspaceID: row.workspace_id,
            title: row.title,
            time: { created: row.time_created, updated: row.time_created },
            directory: row.directory,
            version: "2",
            slug: row.id,
          })
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .get(
      "/:sessionID/children",
      describeRoute({
        summary: "Get session children",
        tags: ["Session"],
        description: "Retrieve all child sessions that were forked from the specified parent session.",
        operationId: "session.children",
        responses: {
          200: {
            description: "List of children",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.children.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await Session.children(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/todo",
      describeRoute({
        summary: "Get session todos",
        description: "Retrieve the todo list associated with a specific session, showing tasks and action items.",
        operationId: "session.todo",
        responses: {
          200: {
            description: "Todo list",
            content: {
              "application/json": {
                schema: resolver(Todo.Info.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        return c.json([])
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create session",
        description: "Create a new OpenCode session for interacting with AI assistants and managing conversations.",
        operationId: "session.create",
        responses: {
          ...errors(400),
          200: {
            description: "Successfully created session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      validator("json", Session.create.schema.optional()),
      async (c) => {
        const body = c.req.valid("json") ?? {}
        const id = "ses_" + Math.random().toString(36).substring(2, 11)
        
        const directory = body.directory || Instance.directory
        
        try {
          let workspace = db.prepare('SELECT id FROM workspaces WHERE directory LIKE ?').get(directory) as any
          if (!workspace) {
            // Try lookup by ID
            workspace = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(directory) as any
            if (!workspace) {
              const allWs = db.prepare('SELECT * FROM workspaces').all() as any[]
              workspace = allWs.find(ws => ws.directory === directory || ws.id === directory)
              if (!workspace) {
                log.error("Workspace not found", { directory, allWorkspaces: allWs })
                return c.json({ error: "Workspace not found" }, 400)
              }
            }
          }
          
          const result = db.prepare('INSERT INTO simple_sessions (id, workspace_id, title, time_created) VALUES (?, ?, ?, ?)').run(id, workspace.id, body.title || "New Chat", Date.now())
          log.info("Inserted session", { id, workspaceId: workspace.id, result })
          
          const sessionInfo = {
            id,
            workspaceID: workspace.id,
            projectID: "default",
            title: body.title || "New Chat",
            time: { created: Date.now(), updated: Date.now() },
            directory: body.directory || directory,
            version: "2",
            slug: id,
          }

          GlobalBus.emit("event", {
            directory: body.directory || directory,
            payload: {
              type: "session.created",
              properties: { info: sessionInfo }
            }
          })
          
          return c.json(sessionInfo)
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .delete(
      "/:sessionID",
      describeRoute({
        summary: "Delete session",
        description: "Delete a session and permanently remove all associated data, including messages and history.",
        operationId: "session.delete",
        responses: {
          200: {
            description: "Successfully deleted session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.remove.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        try {
          db.prepare('DELETE FROM simple_sessions WHERE id = ?').run(sessionID)
          return c.json(true)
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .patch(
      "/:sessionID",
      describeRoute({
        summary: "Update session",
        description: "Update properties of an existing session, such as title or other metadata.",
        operationId: "session.update",
        responses: {
          200: {
            description: "Successfully updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator(
        "json",
        z.object({
          title: z.string().optional(),
          time: z
            .object({
              archived: z.number().optional(),
            })
            .optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const updates = c.req.valid("json")
        
        try {
          if (updates.title !== undefined) {
            db.prepare('UPDATE simple_sessions SET title = ? WHERE id = ?').run(updates.title, sessionID)
          }
          if (updates.time?.archived !== undefined) {
            db.prepare('UPDATE simple_sessions SET time_archived = ? WHERE id = ?').run(updates.time.archived, sessionID)
          }
          
          const updated = db.prepare('SELECT * FROM simple_sessions WHERE id = ?').get(sessionID) as any
          const sessionRow = db.prepare('SELECT workspace_id FROM simple_sessions WHERE id = ?').get(sessionID) as any
          const workspaceRow = db.prepare('SELECT directory FROM workspaces WHERE id = ?').get(sessionRow.workspace_id) as any
          const wsDirectory = workspaceRow.directory

          const sessionInfo = {
            id: updated.id,
            workspaceID: updated.workspace_id,
            projectID: "default",
            title: updated.title,
            time: { created: updated.time_created, updated: updated.time_created, archived: updated.time_archived },
            version: "2",
            slug: updated.id,
          }

          GlobalBus.emit("event", {
            directory: wsDirectory,
            payload: {
              type: "session.updated",
              properties: { info: sessionInfo }
            }
          })
          
          return c.json(sessionInfo)
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .post(
      "/:sessionID/init",
      describeRoute({
        summary: "Initialize session",
        description:
          "Analyze the current application and create an AGENTS.md file with project-specific agent configurations.",
        operationId: "session.init",
        responses: {
          200: {
            description: "200",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator("json", Session.initialize.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        await Session.initialize({ ...body, sessionID })
        return c.json(true)
      },
    )
    .post(
      "/:sessionID/fork",
      describeRoute({
        summary: "Fork session",
        description: "Create a new session by forking an existing session at a specific message point.",
        operationId: "session.fork",
        responses: {
          200: {
            description: "200",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.fork.schema.shape.sessionID,
        }),
      ),
      validator("json", Session.fork.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const result = await Session.fork({ ...body, sessionID })
        return c.json(result)
      },
    )
    .post(
      "/:sessionID/abort",
      describeRoute({
        summary: "Abort session",
        description: "Abort an active session and stop any ongoing AI processing or command execution.",
        operationId: "session.abort",
        responses: {
          200: {
            description: "Aborted session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        SessionPrompt.cancel(c.req.valid("param").sessionID)
        return c.json(true)
      },
    )
    .post(
      "/:sessionID/share",
      describeRoute({
        summary: "Share session",
        description: "Create a shareable link for a session, allowing others to view the conversation.",
        operationId: "session.share",
        responses: {
          200: {
            description: "Successfully shared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.share(sessionID)
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/diff",
      describeRoute({
        summary: "Get message diff",
        description: "Get the file changes (diff) that resulted from a specific user message in the session.",
        operationId: "session.diff",
        responses: {
          200: {
            description: "Successfully retrieved diff",
            content: {
              "application/json": {
                schema: resolver(Snapshot.FileDiff.array()),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionSummary.diff.schema.shape.sessionID,
        }),
      ),
      validator(
        "query",
        z.object({
          messageID: SessionSummary.diff.schema.shape.messageID,
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const params = c.req.valid("param")
        const result = await SessionSummary.diff({
          sessionID: params.sessionID,
          messageID: query.messageID,
        })
        return c.json(result)
      },
    )
    .delete(
      "/:sessionID/share",
      describeRoute({
        summary: "Unshare session",
        description: "Remove the shareable link for a session, making it private again.",
        operationId: "session.unshare",
        responses: {
          200: {
            description: "Successfully unshared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.unshare.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.unshare(sessionID)
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/summarize",
      describeRoute({
        summary: "Summarize session",
        description: "Generate a concise summary of the session using AI compaction to preserve key information.",
        operationId: "session.summarize",
        responses: {
          200: {
            description: "Summarized session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator(
        "json",
        z.object({
          providerID: ProviderID.zod,
          modelID: ModelID.zod,
          auto: z.boolean().optional().default(false),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const session = await Session.get(sessionID)
        await SessionRevert.cleanup(session)
        const msgs = await Session.messages({ sessionID })
        let currentAgent = await Agent.defaultAgent()
        for (let i = msgs.length - 1; i >= 0; i--) {
          const info = msgs[i].info
          if (info.role === "user") {
            currentAgent = info.agent || (await Agent.defaultAgent())
            break
          }
        }
        await SessionCompaction.create({
          sessionID,
          agent: currentAgent,
          model: {
            providerID: body.providerID,
            modelID: body.modelID,
          },
          auto: body.auto,
        })
        await SessionPrompt.loop({ sessionID })
        return c.json(true)
      },
    )
    .get(
      "/:sessionID/message",
      describeRoute({
        summary: "Get session messages",
        description: "Retrieve all messages in a session, including user prompts and AI responses.",
        operationId: "session.messages",
        responses: {
          200: {
            description: "List of messages",
            content: {
              "application/json": {
                schema: resolver(MessageV2.WithParts.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator(
        "query",
        z
          .object({
            limit: z.coerce
              .number()
              .int()
              .min(0)
              .optional()
              .meta({ description: "Maximum number of messages to return" }),
            before: z
              .string()
              .optional()
              .meta({ description: "Opaque cursor for loading older messages" })
              .refine(
                (value) => {
                  if (!value) return true
                  try {
                    MessageV2.cursor.decode(value)
                    return true
                  } catch {
                    return false
                  }
                },
                { message: "Invalid cursor" },
              ),
          })
          .refine((value) => !value.before || value.limit !== undefined, {
            message: "before requires limit",
            path: ["before"],
          }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        try {
          const rows = db.prepare('SELECT * FROM simple_messages WHERE session_id = ? ORDER BY time_created ASC').all(sessionID) as any[]
          
          const messages = rows.map((row, index) => {
            let parentID = undefined
            if (row.role === 'assistant' && index > 0 && rows[index-1].role === 'user') {
              parentID = rows[index-1].id
            }
            return {
              id: row.id,
              sessionID: row.session_id,
              info: { 
                id: row.id,
                sessionID: row.session_id,
                role: row.role, 
                parentID,
                time: { created: row.time_created, updated: row.time_created, completed: row.role === 'assistant' ? row.time_created : undefined },
                ...(row.role === 'assistant' && {
                  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
                  cost: 0
                })
              },
              parts: [{ id: row.id + "_part", messageID: row.id, sessionID: row.session_id, type: 'text', text: row.content, data: { type: 'text', text: row.content }, time: { created: row.time_created, updated: row.time_created } }],
            }
          })
          return c.json(messages)
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .get(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Get message",
        description: "Retrieve a specific message from a session by its message ID.",
        operationId: "session.message",
        responses: {
          200: {
            description: "Message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Info,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
          messageID: MessageID.zod,
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        const message = await MessageV2.get({
          sessionID: params.sessionID,
          messageID: params.messageID,
        })
        return c.json(message)
      },
    )
    .delete(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Delete message",
        description:
          "Permanently delete a specific message (and all of its parts) from a session. This does not revert any file changes that may have been made while processing the message.",
        operationId: "session.deleteMessage",
        responses: {
          200: {
            description: "Successfully deleted message",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
          messageID: MessageID.zod,
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        SessionPrompt.assertNotBusy(params.sessionID)
        await Session.removeMessage({
          sessionID: params.sessionID,
          messageID: params.messageID,
        })
        return c.json(true)
      },
    )
    .delete(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Delete a part from a message",
        operationId: "part.delete",
        responses: {
          200: {
            description: "Successfully deleted part",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
          messageID: MessageID.zod,
          partID: PartID.zod,
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        await Session.removePart({
          sessionID: params.sessionID,
          messageID: params.messageID,
          partID: params.partID,
        })
        return c.json(true)
      },
    )
    .patch(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Update a part in a message",
        operationId: "part.update",
        responses: {
          200: {
            description: "Successfully updated part",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Part),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
          messageID: MessageID.zod,
          partID: PartID.zod,
        }),
      ),
      validator("json", MessageV2.Part),
      async (c) => {
        const params = c.req.valid("param")
        const body = c.req.valid("json")
        if (body.id !== params.partID || body.messageID !== params.messageID || body.sessionID !== params.sessionID) {
          throw new Error(
            `Part mismatch: body.id='${body.id}' vs partID='${params.partID}', body.messageID='${body.messageID}' vs messageID='${params.messageID}', body.sessionID='${body.sessionID}' vs sessionID='${params.sessionID}'`,
          )
        }
        const part = await Session.updatePart(body)
        return c.json(part)
      },
    )
    .post(
      "/:sessionID/oracle",
      describeRoute({
        summary: "Send frozen-context message",
        description: "Query the current session context without persisting the new user/assistant turn.",
        operationId: "session.oracle",
        responses: {
          200: {
            description: "Ephemeral assistant message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator("json", SessionPrompt.PromptInput.omit({ sessionID: true }).extend({ ephemeral: z.boolean().optional() })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        return c.json(await SessionPrompt.prompt({ ...body, sessionID, ephemeral: true }))
      },
    )
    .post(
      "/:sessionID/message",
      describeRoute({
        summary: "Send message",
        description: "Create and send a new message to a session, streaming the AI response.",
        operationId: "session.prompt",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const id = MessageID.ascending()
        const content = body.prompt || (body.parts?.[0]?.type === 'text' ? body.parts[0].text : "Empty Message")
        
        try {
          // Insert user message
          db.prepare('INSERT INTO simple_messages (id, session_id, role, content, time_created) VALUES (?, ?, ?, ?, ?)').run(id, sessionID, 'user', content, Date.now())
          
          // Mock assistant response
          const assistantId = MessageID.ascending()
          const reply = `Echo: ${content}`
          db.prepare('INSERT INTO simple_messages (id, session_id, role, content, time_created) VALUES (?, ?, ?, ?, ?)').run(assistantId, sessionID, 'assistant', reply, Date.now())
          
          const partId = PartID.ascending()
          
          return c.json({
            info: { 
              id: assistantId, 
              sessionID, 
              role: 'assistant', 
              time: { created: Date.now(), updated: Date.now() },
              tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0
            },
            parts: [{ id: partId, messageID: assistantId, sessionID, type: 'text', text: reply, data: { type: 'text', text: reply }, time: { created: Date.now(), updated: Date.now() } }],
          })
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .post(
      "/:sessionID/prompt_async",
      describeRoute({
        summary: "Send async message",
        description:
          "Create and send a new message to a session asynchronously, starting the session if needed and returning immediately.",
        operationId: "session.prompt_async",
        responses: {
          204: {
            description: "Prompt accepted",
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const id = body.messageID || MessageID.ascending()
        const content = body.prompt || (body.parts?.[0]?.type === 'text' ? body.parts[0].text : "Empty Message")
        const modelId = body.model?.modelID || 'gemini-3.1-flash-lite-preview'
        
        try {
          // Insert user message
          db.prepare('INSERT INTO simple_messages (id, session_id, role, content, time_created) VALUES (?, ?, ?, ?, ?)').run(id, sessionID, 'user', content, Date.now())
          
          // Look up workspace directory for events
          const sessionRow = db.prepare('SELECT workspace_id FROM simple_sessions WHERE id = ?').get(sessionID) as any
          const workspaceRow = db.prepare('SELECT directory FROM workspaces WHERE id = ?').get(sessionRow.workspace_id) as any
          const wsDirectory = workspaceRow.directory

          // Update title if it's the first message
          const messageCount = db.prepare('SELECT COUNT(*) as count FROM simple_messages WHERE session_id = ?').get(sessionID) as any
          if (messageCount.count === 1) {
            const title = content.substring(0, 50) + (content.length > 50 ? "..." : "")
            db.prepare('UPDATE simple_sessions SET title = ? WHERE id = ?').run(title, sessionID)
            
            const sessionUpdated = db.prepare('SELECT * FROM simple_sessions WHERE id = ?').get(sessionID) as any
            GlobalBus.emit("event", {
              directory: wsDirectory,
              payload: {
                type: "session.updated",
                properties: {
                  info: {
                    id: sessionUpdated.id,
                    workspaceID: sessionUpdated.workspace_id,
                    projectID: "default",
                    title: sessionUpdated.title,
                    time: { created: sessionUpdated.time_created, updated: sessionUpdated.time_created },
                    version: "2",
                    slug: sessionUpdated.id,
                  }
                }
              }
            })
          }
          
          const defaultAgent = await Agent.defaultAgent()
          const userMsg = { 
            id, 
            sessionID, 
            role: 'user', 
            time: { created: Date.now(), updated: Date.now() },
            agent: defaultAgent,
            model: { providerID: 'google', modelID: modelId }
          }
          
          // @ts-ignore
          Bus.publish(MessageV2.Event.Updated, { info: userMsg })
          
          GlobalBus.emit("event", {
            directory: wsDirectory,
            payload: {
              type: "message.updated",
              properties: { info: userMsg }
            }
          })
          
          // Call real AI in background!
          process.env.GEMINI_API_KEY = "AIzaSyDNyk1exfKPNxY3Hmt6q5_fGth-yyBtkZ8"
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = "AIzaSyDNyk1exfKPNxY3Hmt6q5_fGth-yyBtkZ8"
          const model = google(modelId)
          
          // Load history from simple_messages for context
          const rows = db.prepare('SELECT * FROM simple_messages WHERE session_id = ? ORDER BY time_created ASC').all(sessionID) as any[]
          const history = rows.map(row => ({ role: row.role as 'user' | 'assistant', content: row.content }))

          // We don't await this!
          generateText({
            model,
            messages: [
              ...history,
              { role: "user", content: content }
            ]
          }).then(({ text }) => {
            const assistantId = MessageID.ascending()
            db.prepare('INSERT INTO simple_messages (id, session_id, role, content, time_created) VALUES (?, ?, ?, ?, ?)').run(assistantId, sessionID, 'assistant', text, Date.now())
            
            const assistantMsg = { 
              id: assistantId, 
              sessionID, 
              role: 'assistant', 
              parentID: id, // Fix from turn 17
              time: { created: Date.now(), updated: Date.now(), completed: Date.now() }, // Fix from turn 18
              tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }, 
              cost: 0,
              agent: defaultAgent,
              model: { providerID: 'google', modelID: modelId }
            } as MessageV2.Assistant
            
            // @ts-ignore
            Bus.publish(MessageV2.Event.Updated, { info: assistantMsg })
            
            GlobalBus.emit("event", {
              directory: wsDirectory,
              payload: {
                type: "message.updated",
                properties: { info: assistantMsg }
              }
            })
            
            const partId = PartID.ascending()
            const assistantPart = { id: partId, messageID: assistantId, sessionID, type: 'text', text, data: { type: 'text', text }, time: { created: Date.now(), updated: Date.now() } }
            
            // @ts-ignore
            Bus.publish(MessageV2.Event.PartUpdated, { part: assistantPart })
            
            GlobalBus.emit("event", {
              directory: wsDirectory,
              payload: {
                type: "message.part.updated",
                properties: { part: assistantPart }
              }
            })

            // Emit idle status (Fix from turn 18)
            GlobalBus.emit("event", {
              directory: wsDirectory,
              payload: {
                type: "session.status",
                properties: { sessionID, status: { type: "idle" } }
              }
            })
          }).catch((e) => {
            log.error("Failed to generate text", e)
            SessionStatus.set(sessionID, { type: "idle" })
          }).catch((e) => {
            log.error("Failed to generate text", e)
          })
          
          return c.json({ success: true })
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .post(
      "/:sessionID/command",
      describeRoute({
        summary: "Send command",
        description: "Send a new command to a session for execution by the AI assistant.",
        operationId: "session.command",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator("json", SessionPrompt.CommandInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const msg = await SessionPrompt.command({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/:sessionID/shell",
      describeRoute({
        summary: "Run shell command",
        description: "Execute a shell command within the session context and return the AI's response.",
        operationId: "session.shell",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Assistant),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator("json", SessionPrompt.ShellInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const msg = await SessionPrompt.shell({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/:sessionID/revert",
      describeRoute({
        summary: "Revert message",
        description: "Revert a specific message in a session, undoing its effects and restoring the previous state.",
        operationId: "session.revert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      validator("json", SessionRevert.RevertInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        log.info("revert", c.req.valid("json"))
        const session = await SessionRevert.revert({
          sessionID,
          ...c.req.valid("json"),
        })
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/unrevert",
      describeRoute({
        summary: "Restore reverted messages",
        description: "Restore all previously reverted messages in a session.",
        operationId: "session.unrevert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await SessionRevert.unrevert({ sessionID })
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/permissions/:permissionID",
      describeRoute({
        summary: "Respond to permission",
        deprecated: true,
        description: "Approve or deny a permission request from the AI assistant.",
        operationId: "permission.respond",
        responses: {
          200: {
            description: "Permission processed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionID.zod,
          permissionID: PermissionID.zod,
        }),
      ),
      validator("json", z.object({ response: PermissionNext.Reply })),
      async (c) => {
        const params = c.req.valid("param")
        PermissionNext.reply({
          requestID: params.permissionID,
          reply: c.req.valid("json").response,
        })
        return c.json(true)
      },
    ),
)
