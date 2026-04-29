import z from "zod"
import { Filesystem } from "../util/filesystem"
import path from "path"
import { Log } from "../util/log"
import { Flag } from "@/flag/flag"
import { fn } from "@opencode-ai/util/fn"
import { BusEvent } from "@/bus/bus-event"
import { iife } from "@/util/iife"
import { splitWorkspace } from "@opencode-ai/util/workspace"
import { GlobalBus } from "@/bus/global"
import { existsSync } from "fs"
import { git } from "../util/git"
import { which } from "../util/which"
import { ProjectID } from "./schema"
import { db } from "../storage/simple-db"

export namespace Project {
  const log = Log.create({ service: "project" })

  export const Info = z
    .object({
      id: ProjectID.zod,
      worktree: z.string(),
      vcs: z.literal("git").optional(),
      name: z.string().optional(),
      icon: z
        .object({
          url: z.string().optional(),
          override: z.string().optional(),
          color: z.string().optional(),
        })
        .optional(),
      commands: z
        .object({
          start: z.string().optional().describe("Startup script to run when creating a new workspace (worktree)"),
        })
        .optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        initialized: z.number().optional(),
      }),
      sandboxes: z.array(z.string()),
    })
    .meta({
      ref: "Project",
    })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: BusEvent.define("project.updated", Info),
  }

  export async function fromDirectory(rawDirectory: string) {
    let directory = rawDirectory
    try {
      const decoded = decodeURIComponent(rawDirectory)
      const parts = splitWorkspace(decoded)
      directory = parts.root
    } catch (e) {
      directory = rawDirectory
    }
    log.info("fromDirectory", { directory })

    const worktree = directory
    const id = Math.random().toString(36).substring(2, 11)
    const name = path.basename(directory) || "New Workspace"

    try {
      const existing = db.prepare('SELECT * FROM workspaces WHERE directory = ?').get(directory) as any
      if (existing) {
        return {
          project: {
            id: ProjectID.make(existing.id),
            worktree: existing.directory,
            name: existing.name,
            time: { created: Date.now(), updated: Date.now() },
            sandboxes: [],
          },
          sandbox: existing.directory
        }
      }

      db.prepare('INSERT INTO workspaces (id, name, directory) VALUES (?, ?, ?)').run(id, name, directory)
      
      return {
        project: {
          id: ProjectID.make(id),
          worktree: directory,
          name: name,
          time: { created: Date.now(), updated: Date.now() },
          sandboxes: [],
        },
        sandbox: directory
      }
    } catch (e: any) {
      log.error("Failed to get/create workspace", { error: e.message })
      throw e
    }
  }

  export function list() {
    const rows = db.prepare('SELECT * FROM workspaces').all() as any[]
    return rows.map((row) => ({
      id: ProjectID.make(row.id),
      worktree: row.directory,
      name: row.name,
      time: { created: Date.now(), updated: Date.now() },
      sandboxes: [],
    }))
  }

  export function get(id: ProjectID): Info | undefined {
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any
    if (!row) return undefined
    return {
      id: ProjectID.make(row.id),
      worktree: row.directory,
      name: row.name,
      time: { created: Date.now(), updated: Date.now() },
      sandboxes: [],
    }
  }

  export const update = fn(
    z.object({
      projectID: ProjectID.zod,
      name: z.string().optional(),
    }),
    async (input) => {
      db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(input.name, input.projectID)
      return get(input.projectID)!
    }
  )
}
