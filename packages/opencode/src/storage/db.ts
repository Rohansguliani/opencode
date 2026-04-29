import SqliteDatabase from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { type SQLiteTransaction } from "drizzle-orm/sqlite-core"
import { fileURLToPath } from "url"
export * from "drizzle-orm"
import { Context } from "../util/context"
import { lazy } from "../util/lazy"
import { Global } from "../global"
import { Log } from "../util/log"
import { NamedError } from "@opencode-ai/util/error"
import z from "zod"
import path from "path"
import { readFileSync, readdirSync, existsSync } from "fs"
import * as schema from "./schema"
import { Installation } from "../installation"
import { Flag } from "../flag/flag"
import { iife } from "@/util/iife"

declare const OPENCODE_MIGRATIONS: { sql: string; timestamp: number; name: string }[] | undefined

export const NotFoundError = NamedError.create(
  "NotFoundError",
  z.object({
    message: z.string(),
  }),
)

const log = Log.create({ service: "db" })

export namespace Database {
  export function Path() {
    const channel = Installation.CHANNEL
    if (["latest", "beta"].includes(channel) || Flag.OPENCODE_DISABLE_CHANNEL_DB)
      return path.join(Global.Path.data, "opencode.db")
    const safe = channel.replace(/[^a-zA-Z0-9._-]/g, "-")
    return path.join(Global.Path.data, `opencode-${safe}.db`)
  }

  type Schema = typeof schema
  export type Transaction = SQLiteTransaction<"sync", void, Schema>

  type Client = BetterSQLite3Database

  type Journal = { sql: string; timestamp: number; name: string }[]

  const state = {
    sqlite: undefined as SqliteDatabase | undefined,
  }

  function time(tag: string) {
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(tag)
    if (!match) return 0
    return Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    )
  }



  export const Client = lazy(() => {
    log.info("opening database", { path: Path() })

    const sqlite = new SqliteDatabase(Path())
    state.sqlite = sqlite

    sqlite.exec("PRAGMA journal_mode = WAL")
    sqlite.exec("PRAGMA synchronous = NORMAL")
    sqlite.exec("PRAGMA busy_timeout = 5000")
    sqlite.exec("PRAGMA cache_size = -64000")
    sqlite.exec("PRAGMA foreign_keys = ON")
    sqlite.exec("PRAGMA wal_checkpoint(PASSIVE)")

    const db = drizzle(sqlite)

    // Apply schema migrations
    if (false) { // Disabled for local Node migration
      const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migration")
      log.info("applying migrations", { folder: migrationsFolder })
      
      try {
        const dirs = readdirSync(migrationsFolder, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
          
        for (const name of dirs) {
          const file = path.join(migrationsFolder, name, "migration.sql")
          if (existsSync(file)) {
            const sql = readFileSync(file, "utf-8")
            log.info("Executing migration", { name })
            sqlite.exec(sql)
          }
        }
      } catch (e: any) {
        log.error("Migration failed", { error: e.message })
      }
    }

    return db
  })

  export function close() {
    const sqlite = state.sqlite
    if (!sqlite) return
    sqlite.close()
    state.sqlite = undefined
    Client.reset()
  }

  export type TxOrDb = SQLiteTransaction<"sync", void, any, any> | Client

  const ctx = Context.create<{
    tx: TxOrDb
    effects: (() => void | Promise<void>)[]
  }>("database")

  export function use<T>(callback: (trx: TxOrDb) => T): T {
    try {
      return callback(ctx.use().tx)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = ctx.provide({ effects, tx: Client() }, () => callback(Client()))
        for (const effect of effects) effect()
        return result
      }
      throw err
    }
  }

  export function effect(fn: () => any | Promise<any>) {
    try {
      ctx.use().effects.push(fn)
    } catch {
      fn()
    }
  }

  export function transaction<T>(callback: (tx: TxOrDb) => T): T {
    try {
      return callback(ctx.use().tx)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = (Client().transaction as any)((tx: TxOrDb) => {
          return ctx.provide({ tx, effects }, () => callback(tx))
        })
        for (const effect of effects) effect()
        return result
      }
      throw err
    }
  }
}
