import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = "/Users/rohansguliani/.local/share/opencode/opencode-local.db"
const migrationsFolder = path.resolve(__dirname, "../migration")

console.log(`Opening database at ${dbPath}`)
const db = new Database(dbPath)

console.log(`Reading migrations from ${migrationsFolder}`)
const dirs = fs.readdirSync(migrationsFolder, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const name of dirs) {
  const file = path.join(migrationsFolder, name, "migration.sql")
  if (fs.existsSync(file)) {
    const sql = fs.readFileSync(file, "utf-8")
    console.log(`Executing migration: ${name}`)
    try {
      db.exec(sql)
    } catch (e: any) {
      if (e.message.includes("already exists") || e.message.includes("duplicate column")) {
        console.log(`  Warning: ${e.message} (ignoring)`)
      } else {
        console.error(`  Error in ${name}:`, e.message)
      }
    }
  }
}
db.close()
console.log("Done.")
