import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
  var __schemaReady: Promise<void> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    max: 3,
    idle_timeout: 20,
    prepare: false,
    // keep DATE columns as plain YYYY-MM-DD strings
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
}

export function db() {
  if (!globalThis.__sql) globalThis.__sql = createClient();
  return globalThis.__sql;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  view TEXT NOT NULL DEFAULT 'kanban' CHECK (view IN ('kanban','todo','calendar')),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','on_hold','done')),
  due_date DATE,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_space_idx ON tasks(space_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/** Creates tables on first use, so a fresh database works without a manual migration. */
export function ensureSchema(): Promise<void> {
  if (!globalThis.__schemaReady) {
    globalThis.__schemaReady = db()
      .unsafe(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e) => {
        globalThis.__schemaReady = undefined;
        throw e;
      });
  }
  return globalThis.__schemaReady;
}
