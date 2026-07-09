-- Migração de referência. A execução idempotente equivalente está em src/db.js,
-- mantida junto da abertura do banco para não adicionar um migration runner ao MVP.
-- Tabelas: projects, sessions, session_events, skills, hooks, subagents,
-- prompts, files_touched, tool_calls, settings, scan_runs e warnings.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
