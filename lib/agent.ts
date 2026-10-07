import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { randomUUID } from "crypto";
import { db, ensureSchema } from "./db";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "./constants";
import { addDays, HE_DAYS, parseISO, startOfWeek, todayISO } from "./dates";
import {
  createTasks, deleteTasks, isDate, isPriority, isStatus, listSpaces, listTasks, sanitizeChanges, updateTasks,
  type DueFilter, type TaskChanges, type TaskFilter, type TaskInput,
} from "./repo";
import type { AgentScope, PendingAction, Space, Task } from "./types";

export const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const CONFIRM_THRESHOLD = 3;

interface Ctx {
  spaces: Space[]; // all spaces
  scoped: Space[]; // spaces the agent may touch
  pending: PendingAction | null;
  changes: string[];
  mutated: boolean;
}

// ---------------- tool definitions ----------------
const filterProps = {
  task_ids: { type: "array", items: { type: "integer" }, description: "מזהי משימות ספציפיות" },
  space_id: { type: "integer", description: "הגבלה למרחב אחד (חייב להיות בתוך ההיקף)" },
  statuses: { type: "array", items: { type: "string", enum: STATUSES } },
  priorities: { type: "array", items: { type: "string", enum: PRIORITIES } },
  due: {
    type: "string",
    enum: ["overdue", "today", "tomorrow", "this_week", "next_7_days", "no_date", "has_date", "any"],
    description: "overdue = עבר תאריך היעד ולא הושלמה",
  },
  due_before: { type: "string", description: "YYYY-MM-DD (כולל)" },
  due_after: { type: "string", description: "YYYY-MM-DD (כולל)" },
  search: { type: "string", description: "חיפוש טקסט בכותרת/הערות" },
  include_done: { type: "boolean", description: "לכלול משימות שהושלמו. ברירת מחדל: false (אלא אם נבחרו task_ids או statuses)" },
} as const;

const changesSchema = {
  type: "object",
  description: "השדות לשינוי",
  properties: {
    title: { type: "string" },
    notes: { type: "string" },
    priority: { type: "string", enum: PRIORITIES },
    status: { type: "string", enum: STATUSES },
    due_date: { type: ["string", "null"], description: "YYYY-MM-DD או null להסרת תאריך" },
    space_id: { type: "integer", description: "העברה למרחב אחר (בתוך ההיקף)" },
  },
} as const;

export const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_tasks",
      description: "קריאת משימות מתוך ההיקף הנוכחי לפי סינון. מחזיר רשימה עם id, כותרת, מרחב, עדיפות, סטטוס ותאריך יעד.",
      parameters: { type: "object", properties: { ...filterProps, limit: { type: "integer" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "add_tasks",
      description: "הוספת משימה אחת או יותר.",
      parameters: {
        type: "object",
        required: ["tasks"],
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              required: ["title"],
              properties: {
                title: { type: "string" },
                space_id: { type: "integer", description: "חובה כשההיקף הוא כל המרחבים" },
                priority: { type: "string", enum: PRIORITIES, description: "ברירת מחדל medium" },
                status: { type: "string", enum: STATUSES, description: "ברירת מחדל new" },
                due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
                notes: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tasks",
      description:
        "עדכון משימות. בוחרים משימות לפי task_ids או לפי סינון, או all=true לכל המשימות הפתוחות בהיקף. אם יותר מ-3 משימות ישתנו, המערכת תבקש אישור מהמשתמש אוטומטית.",
      parameters: {
        type: "object",
        required: ["changes"],
        properties: { ...filterProps, all: { type: "boolean", description: "כל המשימות בהיקף" }, changes: changesSchema },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_tasks",
      description: "מחיקת משימות לפי task_ids או סינון. המערכת תמיד תבקש אישור מהמשתמש לפני מחיקה.",
      parameters: { type: "object", properties: { ...filterProps, all: { type: "boolean" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_tasks",
      description: "סיכום וסטטיסטיקה של המשימות בהיקף: פתוחות, באיחור, להיום, דחופות, הושלמו השבוע, ורשימות המשימות החשובות.",
      parameters: { type: "object", properties: { space_id: { type: "integer" } } },
    },
  },
];

// ---------------- helpers ----------------
const spaceName = (ctx: Ctx, id: number) => ctx.spaces.find((s) => s.id === id)?.name ?? `#${id}`;
const inScope = (ctx: Ctx, id: number) => ctx.scoped.some((s) => s.id === id);

function compact(ctx: Ctx, t: Task, today: string) {
  return {
    id: t.id,
    title: t.title,
    space: spaceName(ctx, t.space_id),
    space_id: t.space_id,
    priority: t.priority,
    status: t.status,
    due_date: t.due_date,
    overdue: !!t.due_date && t.due_date < today && t.status !== "done",
    ...(t.notes ? { notes: t.notes.slice(0, 200) } : {}),
  };
}

type Args = Record<string, unknown>;

function buildFilter(ctx: Ctx, a: Args): TaskFilter | { error: string } {
  let spaceIds = ctx.scoped.map((s) => s.id);
  if (typeof a.space_id === "number") {
    if (!inScope(ctx, a.space_id)) return { error: `המרחב ${spaceName(ctx, a.space_id)} מחוץ להיקף הנוכחי` };
    spaceIds = [a.space_id];
  }
  const ids = Array.isArray(a.task_ids) ? a.task_ids.filter((x): x is number => Number.isInteger(x)) : undefined;
  const statuses = Array.isArray(a.statuses) ? a.statuses.filter(isStatus) : undefined;
  const priorities = Array.isArray(a.priorities) ? a.priorities.filter(isPriority) : undefined;
  const includeDone = typeof a.include_done === "boolean" ? a.include_done : ids?.length || statuses?.length ? true : false;
  return {
    ids: ids?.length ? ids : undefined,
    spaceIds,
    statuses,
    priorities,
    due: typeof a.due === "string" ? (a.due as DueFilter) : undefined,
    dueBefore: isDate(a.due_before) ? a.due_before : undefined,
    dueAfter: isDate(a.due_after) ? a.due_after : undefined,
    search: typeof a.search === "string" && a.search.trim() ? a.search.trim() : undefined,
    includeDone,
    limit: typeof a.limit === "number" ? a.limit : undefined,
  };
}

function hasSelector(a: Args) {
  return a.all === true || ["task_ids", "statuses", "priorities", "due", "due_before", "due_after", "search", "space_id"].some(
    (k) => a[k] !== undefined && !(Array.isArray(a[k]) && (a[k] as unknown[]).length === 0),
  );
}

function shortDate(iso: string) {
  const d = parseISO(iso);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}

function describeChanges(ctx: Ctx, c: TaskChanges): string {
  const parts: string[] = [];
  if (c.status) parts.push(`סטטוס ← ${STATUS_META[c.status].label}`);
  if (c.priority) parts.push(`עדיפות ← ${PRIORITY_META[c.priority].label}`);
  if (c.due_date !== undefined) parts.push(c.due_date ? `תאריך יעד ← ${shortDate(c.due_date)}` : "הסרת תאריך יעד");
  if (c.space_id) parts.push(`מעבר למרחב ${spaceName(ctx, c.space_id)}`);
  if (c.title) parts.push(`כותרת ← "${c.title}"`);
  if (c.notes !== undefined) parts.push("עדכון הערות");
  return parts.join(", ");
}

async function createPending(kind: "update" | "delete", ids: number[], changes: TaskChanges | null, description: string, scopeIds: number[]) {
  await ensureSchema();
  const id = randomUUID();
  const sql = db();
  await sql`INSERT INTO agent_actions (id, kind, payload) VALUES (${id}, ${kind}, ${sql.json({ ids, changes, scopeIds } as never)})`;
  return id;
}

// ---------------- tool execution ----------------
async function runTool(ctx: Ctx, name: string, a: Args): Promise<unknown> {
  const today = todayISO();
  switch (name) {
    case "read_tasks": {
      const f = buildFilter(ctx, a);
      if ("error" in f) return f;
      const tasks = await listTasks({ ...f, limit: f.limit ?? 200 });
      return { count: tasks.length, tasks: tasks.map((t) => compact(ctx, t, today)) };
    }

    case "add_tasks": {
      const items = Array.isArray(a.tasks) ? (a.tasks as Args[]) : [];
      const inputs: TaskInput[] = [];
      const errors: string[] = [];
      for (const it of items) {
        const title = typeof it.title === "string" ? it.title.trim() : "";
        if (!title) continue;
        let spaceId = typeof it.space_id === "number" ? it.space_id : undefined;
        if (spaceId === undefined && ctx.scoped.length === 1) spaceId = ctx.scoped[0].id;
        if (spaceId === undefined) { errors.push(`"${title}": חסר space_id`); continue; }
        if (!inScope(ctx, spaceId)) { errors.push(`"${title}": המרחב מחוץ להיקף`); continue; }
        inputs.push({
          space_id: spaceId,
          title,
          priority: isPriority(it.priority) ? it.priority : "medium",
          status: isStatus(it.status) ? it.status : "new",
          due_date: isDate(it.due_date) ? it.due_date : null,
          notes: typeof it.notes === "string" ? it.notes : "",
        });
      }
      const created = await createTasks(inputs);
      if (created.length) {
        ctx.mutated = true;
        ctx.changes.push(created.length === 1 ? "נוספה משימה" : `נוספו ${created.length} משימות`);
      }
      return { added: created.map((t) => compact(ctx, t, today)), errors };
    }

    case "update_tasks":
    case "delete_tasks": {
      if (ctx.pending) return { error: "כבר ממתינה פעולה לאישור המשתמש. אין לבצע פעולות נוספות עד שיאשר." };
      if (!hasSelector(a)) return { error: "יש לבחור משימות (task_ids, סינון, או all=true)" };
      const f = buildFilter(ctx, a);
      if ("error" in f) return f;
      const matched = await listTasks(f);
      if (!matched.length) return { count: 0, message: "לא נמצאו משימות מתאימות" };
      const ids = matched.map((t) => t.id);

      if (name === "update_tasks") {
        const changes = sanitizeChanges((a.changes ?? {}) as Args);
        if (!Object.keys(changes).length) return { error: "לא צוינו שינויים תקינים" };
        if (changes.space_id !== undefined && !inScope(ctx, changes.space_id)) return { error: "מרחב היעד מחוץ להיקף" };
        if (ids.length > CONFIRM_THRESHOLD) {
          const description = `עדכון ${ids.length} משימות: ${describeChanges(ctx, changes)}`;
          const id = await createPending("update", ids, changes, description, ctx.scoped.map((s) => s.id));
          ctx.pending = { id, kind: "update", count: ids.length, description };
          return { requires_confirmation: true, count: ids.length, description, instruction: "בקש מהמשתמש אישור במשפט קצר אחד וציין כמה משימות ישתנו. אל תטען שהפעולה בוצעה." };
        }
        const updated = await updateTasks(ids, changes);
        ctx.mutated = true;
        ctx.changes.push(updated.length === 1 ? "עודכנה משימה" : `עודכנו ${updated.length} משימות`);
        return { updated: updated.map((t) => compact(ctx, t, today)) };
      }

      const titles = matched.slice(0, 5).map((t) => t.title).join(", ");
      const description = `מחיקת ${ids.length === 1 ? "משימה אחת" : `${ids.length} משימות`}: ${titles}${matched.length > 5 ? "…" : ""}`;
      const id = await createPending("delete", ids, null, description, ctx.scoped.map((s) => s.id));
      ctx.pending = { id, kind: "delete", count: ids.length, description };
      return { requires_confirmation: true, count: ids.length, description, instruction: "בקש מהמשתמש אישור למחיקה במשפט קצר אחד וציין כמה משימות יימחקו. אל תטען שהפעולה בוצעה." };
    }

    case "summarize_tasks": {
      let scope = ctx.scoped;
      if (typeof a.space_id === "number") {
        if (!inScope(ctx, a.space_id)) return { error: "המרחב מחוץ להיקף" };
        scope = scope.filter((s) => s.id === a.space_id);
      }
      const all = await listTasks({ spaceIds: scope.map((s) => s.id) });
      const weekStart = startOfWeek(today);
      const open = all.filter((t) => t.status !== "done");
      const overdue = open.filter((t) => t.due_date && t.due_date < today);
      const dueToday = open.filter((t) => t.due_date === today);
      const urgent = open.filter((t) => t.priority === "urgent");
      const doneWeek = all.filter((t) => t.status === "done" && t.completed_at && todayISO(new Date(t.completed_at)) >= weekStart);
      const count = <K extends string>(list: Task[], key: (t: Task) => K) =>
        list.reduce<Record<string, number>>((m, t) => ((m[key(t)] = (m[key(t)] ?? 0) + 1), m), {});
      return {
        today,
        per_space: scope.map((s) => {
          const ts = all.filter((t) => t.space_id === s.id);
          const o = ts.filter((t) => t.status !== "done");
          return {
            space: s.name,
            open: o.length,
            overdue: o.filter((t) => t.due_date && t.due_date < today).length,
            due_today: o.filter((t) => t.due_date === today).length,
            completed_this_week: ts.filter((t) => t.status === "done" && t.completed_at && todayISO(new Date(t.completed_at)) >= weekStart).length,
          };
        }),
        totals: {
          open: open.length,
          overdue: overdue.length,
          due_today: dueToday.length,
          urgent: urgent.length,
          completed_this_week: doneWeek.length,
          by_status: count(all, (t) => t.status),
          open_by_priority: count(open, (t) => t.priority),
        },
        overdue: overdue.slice(0, 15).map((t) => compact(ctx, t, today)),
        due_today: dueToday.slice(0, 15).map((t) => compact(ctx, t, today)),
        urgent: urgent.slice(0, 15).map((t) => compact(ctx, t, today)),
        upcoming_week: open
          .filter((t) => t.due_date && t.due_date > today && t.due_date <= addDays(today, 7))
          .slice(0, 15)
          .map((t) => compact(ctx, t, today)),
      };
    }
  }
  return { error: `כלי לא מוכר: ${name}` };
}

// ---------------- system prompt ----------------
function systemPrompt(ctx: Ctx, scope: AgentScope): string {
  const today = todayISO();
  const days = Array.from({ length: 21 }, (_, i) => {
    const iso = addDays(today, i);
    const label = i === 0 ? " (היום)" : i === 1 ? " (מחר)" : "";
    return `יום ${HE_DAYS[parseISO(iso).getUTCDay()]} ${iso}${label}`;
  }).join("\n");
  const scopeText =
    scope.type === "all"
      ? "כל המרחבים"
      : `מרחב אחד בלבד: "${ctx.scoped[0]?.name}" (space_id=${ctx.scoped[0]?.id})`;
  return `אתה "העוזר" - סוכן AI בתוך מערכת לניהול משימות בעברית.

היום: ${today}, יום ${HE_DAYS[parseISO(today).getUTCDay()]}. אזור זמן: ישראל. השבוע מתחיל ביום ראשון.
לוח תאריכים לעזר:
${days}

היקף העבודה הנוכחי: ${scopeText}.
המרחבים שבהיקף (id: שם):
${ctx.scoped.map((s) => `${s.id}: ${s.name}`).join("\n")}
${scope.type === "space" ? `מרחבים אחרים במערכת (מחוץ להיקף, אסור לגעת בהם): ${ctx.spaces.filter((s) => !inScope(ctx, s.id)).map((s) => s.name).join(", ") || "אין"}` : ""}

ערכים: עדיפות low=נמוכה, medium=בינונית, high=גבוהה, urgent=דחוף. סטטוס new=חדשה, in_progress=בעבודה, on_hold=בהשהייה, done=הושלמה.

כללים:
- פעל רק על המשימות שבהיקף. אם המשתמש מבקש משהו על מרחב מחוץ להיקף - הסבר בקצרה שצריך לבחור אותו (או "כל המרחבים") בראש חלון הצ'אט.
- השתמש בכלים כדי לקרוא ולשנות נתונים. לעולם אל תמציא משימות או מספרים.
- אם המשתמש מזכיר משימה בשמה, קרא קודם (read_tasks עם search) כדי למצוא את ה-id.
- תאריכים: חשב לפי לוח התאריכים. "עד ה-10" = היום ה-10 הקרוב (בחודש הנוכחי אם טרם עבר, אחרת בחודש הבא). "מחר" = ${addDays(today, 1)}. "לדחות למחר" = לשנות due_date למחר.
- בהוספה בלי עדיפות מפורשת: medium. אם נאמר "דחוף" - urgent.
- לפני פעולה על יותר מ-3 משימות או לפני מחיקה, אל תשאל בעצמך - פשוט קרא לכלי. המערכת תציג למשתמש כפתורי אישור ותחכה לתשובה. אחרי שהכלי מחזיר requires_confirmation, כתוב משפט אחד: כמה משימות ישתנו ובקש אישור.
- אחרי כל פעולה ענה בעברית קצרה (1-2 משפטים) מה בדיוק עשית.
- בשאלות כמו "מה הכי חשוב" - השתמש ב-summarize_tasks וענה ברשימה קצרה ומנומקת (עד 5 פריטים), לפי: באיחור, דחוף, להיום, עדיפות גבוהה.
- סגנון: עברית טבעית, קצר וברור. אפשר להשתמש ב-**הדגשה** ורשימות עם "-". בלי כותרות ובלי טבלאות.`;
}

// ---------------- main entry ----------------
export interface AgentResult {
  reply: string;
  changed: boolean;
  changes: string[];
  pending: PendingAction | null;
}

export async function runAgent(history: { role: "user" | "assistant"; content: string }[], scope: AgentScope): Promise<AgentResult> {
  const spaces = await listSpaces();
  const scoped = scope.type === "all" ? spaces : spaces.filter((s) => s.id === scope.spaceId);
  if (scope.type === "space" && !scoped.length) {
    return { reply: "המרחב שנבחר לא קיים יותר. בחר מרחב אחר בראש החלון.", changed: false, changes: [], pending: null };
  }
  const ctx: Ctx = { spaces, scoped, pending: null, changes: [], mutated: false };
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(ctx, scope) },
    ...history.slice(-16).map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ];

  for (let step = 0; step < 8; step++) {
    const res = await client.chat.completions.create({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" });
    const msg = res.choices[0]?.message;
    if (!msg) break;
    const calls = msg.tool_calls ?? [];
    if (!calls.length) {
      return { reply: msg.content?.trim() || "בוצע.", changed: ctx.mutated, changes: ctx.changes, pending: ctx.pending };
    }
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
    for (const call of calls) {
      if (call.type !== "function") continue;
      let result: unknown;
      try {
        const args = JSON.parse(call.function.arguments || "{}") as Args;
        result = await runTool(ctx, call.function.name, args);
      } catch (e) {
        console.error("tool error", call.function.name, e);
        result = { error: "הכלי נכשל" };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return {
    reply: ctx.pending ? `${ctx.pending.description}. לאשר?` : "סיימתי.",
    changed: ctx.mutated,
    changes: ctx.changes,
    pending: ctx.pending,
  };
}

/** Runs (or cancels) an action the agent proposed and the user approved via the chat buttons. */
export async function resolvePending(id: string, approve: boolean): Promise<{ message: string; changed: boolean }> {
  await ensureSchema();
  const sql = db();
  const [action] = await sql<{ kind: string; payload: { ids: number[]; changes: TaskChanges | null; scopeIds: number[] } }[]>`
    UPDATE agent_actions SET status = ${approve ? "approved" : "rejected"}
    WHERE id = ${id} AND status = 'pending' AND created_at > now() - interval '1 hour'
    RETURNING kind, payload`;
  if (!action) return { message: "הבקשה הזו כבר טופלה או פגה. אפשר לבקש שוב.", changed: false };
  if (!approve) return { message: "בסדר, ביטלתי. לא שיניתי כלום.", changed: false };

  // re-check scope at execution time
  const current = await listTasks({ ids: action.payload.ids, spaceIds: action.payload.scopeIds, includeDone: true });
  const ids = current.map((t) => t.id);
  if (!ids.length) return { message: "המשימות כבר לא קיימות, לא היה מה לשנות.", changed: false };

  if (action.kind === "delete") {
    const n = await deleteTasks(ids);
    return { message: n === 1 ? "✓ מחקתי משימה אחת." : `✓ מחקתי ${n} משימות.`, changed: true };
  }
  const updated = await updateTasks(ids, action.payload.changes ?? {});
  const c = action.payload.changes ?? {};
  const what = c.status
    ? `לסטטוס "${STATUS_META[c.status].label}"`
    : c.due_date
      ? `לתאריך ${shortDate(c.due_date)}`
      : c.priority
        ? `לעדיפות "${PRIORITY_META[c.priority].label}"`
        : "";
  return { message: `✓ עדכנתי ${updated.length} משימות${what ? " " + what : ""}.`, changed: true };
}
