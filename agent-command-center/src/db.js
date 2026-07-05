import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function abrir_banco(caminho) {
  mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY, path TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      agents_md INTEGER NOT NULL DEFAULT 0, claude_md INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, source_path TEXT NOT NULL UNIQUE,
      project_id INTEGER REFERENCES projects(id), title TEXT NOT NULL,
      status TEXT NOT NULL, model TEXT, effort TEXT, created_at TEXT,
      updated_at TEXT NOT NULL, tokens INTEGER, cost REAL, snippet TEXT,
      tools_json TEXT NOT NULL DEFAULT '[]', files_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]', source_mtime REAL NOT NULL,
      source_size INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session_events (
      id INTEGER PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      position INTEGER NOT NULL, timestamp TEXT, kind TEXT NOT NULL, role TEXT,
      summary TEXT NOT NULL, raw_json TEXT, UNIQUE(session_id, position)
    );
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, platform TEXT NOT NULL, path TEXT NOT NULL UNIQUE,
      description TEXT, scope TEXT NOT NULL, triggers_json TEXT NOT NULL DEFAULT '[]',
      has_scripts INTEGER NOT NULL DEFAULT 0, has_references INTEGER NOT NULL DEFAULT 0,
      has_assets INTEGER NOT NULL DEFAULT 0, warnings_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hooks (
      id INTEGER PRIMARY KEY, platform TEXT NOT NULL, event TEXT NOT NULL,
      matcher TEXT, source_path TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
      description TEXT, UNIQUE(platform, event, matcher, source_path)
    );
    CREATE TABLE IF NOT EXISTS subagents (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, platform TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE, description TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
      target TEXT NOT NULL DEFAULT 'either', project TEXT, priority TEXT NOT NULL DEFAULT 'medium',
      context_pack TEXT, model TEXT, effort TEXT, status TEXT NOT NULL DEFAULT 'draft',
      complexity TEXT, expected_output TEXT, checklist TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files_touched (
      id INTEGER PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      path TEXT NOT NULL, UNIQUE(session_id, path)
    );
    CREATE TABLE IF NOT EXISTS tool_calls (
      id INTEGER PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, UNIQUE(session_id, name)
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scan_runs (
      id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
      files_seen INTEGER NOT NULL DEFAULT 0, indexed INTEGER NOT NULL DEFAULT 0,
      errors INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY, scan_run_id INTEGER REFERENCES scan_runs(id),
      source_path TEXT, message TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_updated_idx ON sessions(updated_at DESC);
    CREATE INDEX IF NOT EXISTS events_session_idx ON session_events(session_id, position);
  `);
  return db;
}
