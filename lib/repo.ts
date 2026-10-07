import { db, ensureSchema } from "./db";
import { PRIORITIES, STATUSES, VIEWS } from "./constants";
import { addDays, startOfWeek, todayISO } from "./dates";
import type { Priority, Space, Status, Task, ViewType } from "./types";

// ---------- validation helpers ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);
export const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
export const isView = (v: unknown): v is ViewType => VIEWS.includes(v as ViewType);
export const isDate = (v: unknown): v is string => typeof v === "string" && DATE_RE.test(v) && !isNaN(Date.parse(v));

// ---------- spaces ----------
export async function listSpaces(): Promise<Space[]> {
  await ensureSchema();
  return db()<Space[]>`SELECT * FROM spaces ORDER BY position, id`;
}

export async function createSpace(input: { name: string; color: string; view: ViewType }): Promise<Space> {
  await ensureSchema();
  const [row] = await db()<Space[]>`
    INSERT INTO spaces (name, color, view, position)
    VALUES (${input.name}, ${input.color}, ${input.view}, COALESCE((SELECT MAX(position) + 1 FROM spaces), 0))
    RETURNING *`;
  return row;
}

export async function updateSpace(id: number, input: Partial<Pick<Space, "name" | "color" | "view">>): Promise<Space | null> {
  await ensureSchema();
  const changes: Record<string, string> = {};
  if (input.name) changes.name = input.name;
  if (input.color) changes.color = input.color;
  if (input.view && isView(input.view)) changes.view = input.view;
  if (!Object.keys(changes).length) return (await db()<Space[]>`SELECT * FROM spaces WHERE id = ${id}`)[0] ?? null;
  const [row] = await db()<Space[]>`UPDATE spaces SET ${db()(changes)} WHERE id = ${id} RETURNING *`;
  return row ?? null;
}

export async function deleteSpace(id: number): Promise<void> {
  await ensureSchema();
  await db()`DELETE FROM spaces WHERE id = ${id}`;
}

// ---------- tasks ----------
export type DueFilter = "overdue" | "today" | "tomorrow" | "this_week" | "next_7_days" | "no_date" | "has_date" | "any";

export interface TaskFilter {
  ids?: number[];
  spaceIds?: number[];
  statuses?: Status[];
  priorities?: Priority[];
  due?: DueFilter;
  dueBefore?: string;
  dueAfter?: string;
  search?: string;
  includeDone?: boolean;
  limit?: number;
}

export async function listTasks(filter: TaskFilter = {}): Promise<Task[]> {
  await ensureSchema();
  const sql = db();
  const today = todayISO();
  const conds = [sql`TRUE`];
  if (filter.ids) conds.push(sql`id = ANY(${filter.ids.length ? filter.ids : [-1]}::int[])`);
  if (filter.spaceIds) conds.push(sql`space_id = ANY(${filter.spaceIds.length ? filter.spaceIds : [-1]}::int[])`);
  if (filter.statuses?.length) conds.push(sql`status = ANY(${filter.statuses}::text[])`);
  else if (filter.includeDone === false) conds.push(sql`status <> 'done'`);
  if (filter.priorities?.length) conds.push(sql`priority = ANY(${filter.priorities}::text[])`);
  switch (filter.due) {
    case "overdue": conds.push(sql`due_date < ${today}::date AND status <> 'done'`); break;
    case "today": conds.push(sql`due_date = ${today}::date`); break;
    case "tomorrow": conds.push(sql`due_date = ${addDays(today, 1)}::date`); break;
    case "this_week": conds.push(sql`due_date BETWEEN ${startOfWeek(today)}::date AND ${addDays(startOfWeek(today), 6)}::date`); break;
    case "next_7_days": conds.push(sql`due_date BETWEEN ${today}::date AND ${addDays(today, 7)}::date`); break;
    case "no_date": conds.push(sql`due_date IS NULL`); break;
    case "has_date": conds.push(sql`due_date IS NOT NULL`); break;
  }
  if (filter.dueBefore && isDate(filter.dueBefore)) conds.push(sql`due_date <= ${filter.dueBefore}::date`);
  if (filter.dueAfter && isDate(filter.dueAfter)) conds.push(sql`due_date >= ${filter.dueAfter}::date`);
  if (filter.search) conds.push(sql`(title ILIKE ${"%" + filter.search + "%"} OR notes ILIKE ${"%" + filter.search + "%"})`);
  const where = conds.reduce((acc, c) => sql`${acc} AND ${c}`);
  const limit = Math.min(filter.limit ?? 1000, 1000);
  return sql<Task[]>`SELECT * FROM tasks WHERE ${where} ORDER BY position, id LIMIT ${limit}`;
}

export interface TaskInput {
  space_id: number;
  title: string;
  notes?: string;
  priority?: Priority;
  status?: Status;
  due_date?: string | null;
}

export async function createTasks(inputs: TaskInput[]): Promise<Task[]> {
  await ensureSchema();
  if (!inputs.length) return [];
  const sql = db();
  const [{ max }] = await sql<{ max: number | null }[]>`SELECT MAX(position) AS max FROM tasks`;
  let pos = (max ?? 0) + 1;
  const rows = inputs.map((t) => {
    const status = isStatus(t.status) ? t.status : "new";
    return {
      space_id: t.space_id,
      title: t.title.trim(),
      notes: t.notes ?? "",
      priority: isPriority(t.priority) ? t.priority : "medium",
      status,
      due_date: isDate(t.due_date) ? t.due_date : null,
      position: pos++,
      completed_at: status === "done" ? new Date() : null,
    };
  });
  return sql<Task[]>`INSERT INTO tasks ${sql(rows)} RETURNING *`;
}

export interface TaskChanges {
  title?: string;
  notes?: string;
  priority?: Priority;
  status?: Status;
  due_date?: string | null;
  space_id?: number;
  position?: number;
}

export function sanitizeChanges(input: Record<string, unknown>): TaskChanges {
  const c: TaskChanges = {};
  if (typeof input.title === "string" && input.title.trim()) c.title = input.title.trim();
  if (typeof input.notes === "string") c.notes = input.notes;
  if (isPriority(input.priority)) c.priority = input.priority;
  if (isStatus(input.status)) c.status = input.status;
  if (input.due_date === null || input.due_date === "") c.due_date = null;
  else if (isDate(input.due_date)) c.due_date = input.due_date;
  if (typeof input.space_id === "number" && Number.isInteger(input.space_id)) c.space_id = input.space_id;
  if (typeof input.position === "number" && isFinite(input.position)) c.position = input.position;
  return c;
}

export async function updateTasks(ids: number[], changes: TaskChanges): Promise<Task[]> {
  await ensureSchema();
  if (!ids.length || !Object.keys(changes).length) return [];
  const sql = db();
  const set: Record<string, unknown> = { ...changes };
  const completed =
    changes.status === undefined
      ? sql`completed_at`
      : changes.status === "done"
        ? sql`COALESCE(completed_at, now())`
        : sql`NULL`;
  return sql<Task[]>`
    UPDATE tasks SET ${sql(set)}, completed_at = ${completed}, updated_at = now()
    WHERE id = ANY(${ids}::int[]) RETURNING *`;
}

export async function deleteTasks(ids: number[]): Promise<number> {
  await ensureSchema();
  if (!ids.length) return 0;
  const res = await db()`DELETE FROM tasks WHERE id = ANY(${ids}::int[])`;
  return res.count;
}

/** Kanban drop: sets the status of a column and the order of its cards. */
export async function reorderColumn(status: Status, orderedIds: number[]): Promise<void> {
  await ensureSchema();
  if (!orderedIds.length) return;
  const sql = db();
  const positions = orderedIds.map((_, i) => i);
  await sql`
    UPDATE tasks t SET
      position = v.pos,
      status = ${status},
      completed_at = CASE WHEN ${status} = 'done' THEN COALESCE(t.completed_at, now()) ELSE NULL END,
      updated_at = CASE WHEN t.status <> ${status} THEN now() ELSE t.updated_at END
    FROM (SELECT unnest(${orderedIds}::int[]) AS id, unnest(${positions}::int[]) AS pos) v
    WHERE t.id = v.id`;
}

// ---------- settings ----------
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  await ensureSchema();
  const [row] = await db()<{ value: T }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return row ? row.value : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${sql.json(value as never)})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
