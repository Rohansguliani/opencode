import { Hono } from "hono"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import { Project } from "../../project/project"
import z from "zod"
import { ProjectID } from "../../project/schema"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { InstanceBootstrap } from "../../project/bootstrap"
import { searchProjectMessages } from "../../session/session.sql"
import { Database } from "../../storage/db"
import { db } from "../../storage/simple-db"
import { SessionID, MessageID, PartID } from "../../session/schema"
import { streamSSE } from "hono/streaming"
import { LLM } from "../../session/llm"
import { Agent } from "../../agent/agent"
import { eq } from "drizzle-orm"
import { ProjectTable } from "../../project/project.sql"
import { Provider } from "../../provider/provider"
import { MessageV2 } from "../../session/message-v2"
import { SystemPrompt } from "../../session/system"
import { InstructionPrompt } from "../../session/instruction"
import { Instance } from "../../project/instance"

export const ProjectRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List all projects",
        description: "Get a list of projects that have been opened with OpenCode.",
        operationId: "project.list",
        responses: {
          200: {
            description: "List of projects",
            content: {
              "application/json": {
                schema: resolver(Project.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const workspaces = db.prepare('SELECT * FROM workspaces').all()
        return c.json(workspaces)
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create or get project",
        description: "Create a project explicitly for a directory, optionally setting a name.",
        operationId: "project.create",
        responses: {
          200: {
            description: "Project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.object({ directory: z.string(), name: z.string().optional() })),
      async (c) => {
        const body = c.req.valid("json")
        const name = body.name || body.directory.split('/').pop() || "New Workspace"
        try {
          const existing = db.prepare('SELECT * FROM workspaces WHERE directory = ?').get(body.directory) as any
          if (existing) return c.json(existing)
          
          const id = Math.random().toString(36).substring(2, 11) // Simple ID generation
          db.prepare('INSERT INTO workspaces (id, name, directory) VALUES (?, ?, ?)').run(id, name, body.directory)
          return c.json({ id, name, directory: body.directory })
        } catch (e: any) {
          return c.json({ error: e.message }, 500)
        }
      },
    )
    .get(
      "/current",
      describeRoute({
        summary: "Get current project",
        description: "Retrieve the currently active project that OpenCode is working with.",
        operationId: "project.current",
        responses: {
          200: {
            description: "Current project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(Instance.project)
      },
    )
    .post(
      "/git/init",
      describeRoute({
        summary: "Initialize git repository",
        description: "Create a git repository for the current project and return the refreshed project info.",
        operationId: "project.initGit",
        responses: {
          200: {
            description: "Project information after git initialization",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        const dir = Instance.directory
        const prev = Instance.project
        const next = await Project.initGit({
          directory: dir,
          project: prev,
        })
        if (next.id === prev.id && next.vcs === prev.vcs && next.worktree === prev.worktree) return c.json(next)
        await Instance.reload({
          directory: dir,
          worktree: dir,
          project: next,
          init: InstanceBootstrap,
        })
        return c.json(next)
      },
    )
    .patch(
      "/:projectID",
      describeRoute({
        summary: "Update project",
        description: "Update project properties such as name, icon, and commands.",
        operationId: "project.update",
        responses: {
          200: {
            description: "Updated project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ projectID: ProjectID.zod })),
      validator("json", Project.update.schema.omit({ projectID: true })),
      async (c) => {
        const projectID = c.req.valid("param").projectID
        const body = c.req.valid("json")
        const project = await Project.update({ ...body, projectID })
        return c.json(project)
      },
    )
    .post(
      "/:projectId/oracle",
      describeRoute({
        summary: "Project Oracle",
        description: "Ask the project oracle a question based on its history.",
        operationId: "project.oracle",
        responses: {
          200: {
            description: "Oracle response stream",
          },
        },
      }),
      validator(
        "param",
        z.object({
          projectId: ProjectID.zod,
        }),
      ),
      validator(
        "json",
        z.object({
          prompt: z.string(),
          agent: z.string().optional(),
          model: z.object({ providerID: z.string(), modelID: z.string() }).optional(),
        })
      ),
      async (c) => {
        const projectId = c.req.valid("param").projectId
        const { prompt, agent: agentName, model: modelInput } = c.req.valid("json")
        
        // Find relevant context
        const contextParts = await Database.use(db => searchProjectMessages(db, projectId, prompt, 10))
        let contextText = ""
        if (contextParts && contextParts.length > 0) {
          contextText = "Here is relevant past context from the user's workspace:\n\n"
          for (const part of contextParts) {
            contextText += `[From session ${part.session_id}]: ${part.content}\n\n`
          }
        }

        const combinedPrompt = contextText ? `${contextText}\nUser query: ${prompt}` : prompt
        const sessionID = SessionID.descending()
        
        return streamSSE(c, async (stream) => {
          try {
            const abort = new AbortController()
            const resolvedAgentName = agentName || (await Agent.defaultAgent())
            const agent = await Agent.get(resolvedAgentName)
            if (!agent) throw new Error("Agent not found")
            
            const providerID = (modelInput?.providerID || agent.model?.providerID || "opencode") as any
            const modelID = (modelInput?.modelID || agent.model?.modelID || "opencode") as any
            const model = await Provider.getModel(providerID, modelID)

            const userMsg = {
              id: MessageID.ascending(),
              parentID: MessageID.ascending(),
              role: "user",
              agent: agent.name,
              model: modelInput || agent.model,
              time: { created: Date.now() },
              sessionID,
              format: undefined,
              tools: {},
            } as unknown as MessageV2.User
            
            const skills = await SystemPrompt.skills(agent)
            const system = [
              ...(await SystemPrompt.environment(model)),
              ...(skills ? [skills] : []),
              ...(await InstructionPrompt.system()),
              "<system-reminder>Project Oracle is active. Answer the user's query based on the provided context. Be concise and helpful.</system-reminder>"
            ]
            
            const messages = [{
              role: "user",
              content: [{ type: "text", text: combinedPrompt }]
            }]
            
            const llmStream = await LLM.stream({
              user: userMsg,
              agent,
              abort: abort.signal,
              sessionID,
              system,
              messages: messages as any,
              tools: {},
              model,
            })

            for await (const value of llmStream.fullStream) {
              await stream.writeSSE({ data: JSON.stringify(value) })
            }
          } catch (e: any) {
            console.error("Oracle stream error:", e)
            await stream.writeSSE({ data: JSON.stringify({ type: "text-delta", text: `\n\n[Error: ${e.message}]` }) })
          }
        })
      }
    )
    .post(
      "/:projectId/promote",
      describeRoute({
        summary: "Promote Oracle Response to Session",
        operationId: "project.promote",
      }),
      validator(
        "param",
        z.object({
          projectId: ProjectID.zod,
        }),
      ),
      validator(
        "json",
        z.object({
          prompt: z.string(),
          response: z.string(),
        })
      ),
      async (c) => {
        const projectId = c.req.valid("param").projectId
        const { prompt, response } = c.req.valid("json")
        
        const project = await Database.use(db => db.select().from(ProjectTable).where(eq(ProjectTable.id, projectId)).get())
        if (!project) throw new Error("Project not found")

        const sessionID = SessionID.descending()
        
        await Database.transaction(async (tx) => {
           await tx.insert(require("../../session/session.sql").SessionTable).values({
             id: sessionID,
             project_id: projectId,
             directory: project.worktree,
             title: prompt.substring(0, 50),
             slug: prompt.substring(0, 50).replace(/[^a-z0-9]/gi, "-").toLowerCase(),
             version: "2",
             time_created: Date.now(),
             time_updated: Date.now(),
           })

           const userMsgID = MessageID.ascending()
           await tx.insert(require("../../session/session.sql").MessageTable).values({
             id: userMsgID,
             session_id: sessionID,
             project_id: projectId,
             time_created: Date.now(),
             time_updated: Date.now(),
             data: {
               id: userMsgID,
               role: "user",
               time: { created: Date.now() },
             } as any
           })

           await tx.insert(require("../../session/session.sql").PartTable).values({
             id: PartID.ascending(),
             message_id: userMsgID,
             session_id: sessionID,
             time_created: Date.now(),
             time_updated: Date.now(),
             data: { type: "text", text: prompt } as any
           })

           const asstMsgID = MessageID.ascending()
           await tx.insert(require("../../session/session.sql").MessageTable).values({
             id: asstMsgID,
             session_id: sessionID,
             project_id: projectId,
             time_created: Date.now(),
             time_updated: Date.now(),
             data: {
               id: asstMsgID,
               parentID: userMsgID,
               role: "assistant",
               time: { created: Date.now() },
             } as any
           })

           await tx.insert(require("../../session/session.sql").PartTable).values({
             id: PartID.ascending(),
             message_id: asstMsgID,
             session_id: sessionID,
             time_created: Date.now(),
             time_updated: Date.now(),
             data: { type: "text", text: response } as any
           })
        })
        
        return c.json({ sessionID })
      }
    )
)