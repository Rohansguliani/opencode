import Database from 'better-sqlite3';
import path from 'path';
import { Global } from '../global';

const dbPath = path.join(Global.Path.data, "opencode-local.db");
console.log(`Opening simple DB at ${dbPath}`);
const db = new Database(dbPath);

// Initialize simple tables
db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    directory TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS simple_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    time_archived INTEGER,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS simple_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES simple_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS account_state (
    id INTEGER PRIMARY KEY,
    active_account_id TEXT,
    active_org_id TEXT
  );

  INSERT OR IGNORE INTO account_state (id, active_account_id, active_org_id) VALUES (1, NULL, NULL);

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    directory TEXT NOT NULL,
    slug TEXT NOT NULL,
    version TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS permission (
    project_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_state (
    actor TEXT PRIMARY KEY,
    projects TEXT NOT NULL,
    last_project TEXT,
    page TEXT NOT NULL,
    time_updated INTEGER NOT NULL
  );
`);

export { db };
