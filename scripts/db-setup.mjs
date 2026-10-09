// Creates the tables and (with --seed) inserts demo data.
// Usage: npm run db:setup  |  npm run db:seed  (seeds only when there are no spaces yet)
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(".env"));
loadEnv(path.resolve(".env.local"));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const sql = postgres(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", max: 1, prepare: false, onnotice: () => {} });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6366f1',
  view TEXT NOT NULL DEFAULT 'kanban' CHECK (view IN ('kanban','todo','calendar')),
  position INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY, space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','on_hold','done')),
  due_date DATE, position DOUBLE PRECISION NOT NULL DEFAULT 0, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS tasks_space_idx ON tasks(space_id);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY, kind TEXT NOT NULL, payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const day = (offset) => {
  if (offset === null) return null;
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

// [title, priority, dueOffset, status, notes?]
const DATA = [
  {
    name: "בית", color: "#f97316", view: "todo",
    tasks: [
      ["לשלם ארנונה", "urgent", 3, "new", "אפשר לשלם באתר העירייה"],
      ["לחדש ביטוח רכב", "urgent", 0, "in_progress", "להשוות בין 3 הצעות"],
      ["לשלם חשבון חשמל", "high", 0, "new"],
      ["להזמין טכנאי למזגן", "high", -2, "new", "המזגן בסלון מטפטף"],
      ["לקנות מתנה ליום הולדת של נועה", "high", 5, "new"],
      ["להתקשר לסבתא", "medium", 0, "new"],
      ["קניות לשבת בסופר", "medium", 2, "new", "חלב, לחם, ירקות, פירות"],
      ["לתאם תור לרופא שיניים", "medium", -1, "on_hold"],
      ["לקבוע טיפול 10,000 לרכב", "medium", 8, "new"],
      ["להשקות את העציצים בגינה", "low", 1, "new"],
      ["לסדר את המחסן", "low", 10, "new"],
      ["להחליף נורה במרפסת", "low", null, "new"],
      ["לבטל מנוי לחדר כושר", "low", 14, "new"],
      ["לאסוף חבילה מהדואר", "medium", -3, "done"],
      ["לנקות את הבית לקראת אורחים", "high", -1, "done"],
    ],
  },
  {
    name: "עבודה", color: "#6366f1", view: "kanban",
    tasks: [
      ["להכין מצגת לישיבת הנהלה", "urgent", 1, "in_progress", "כולל נתוני רבעון שלישי"],
      ["לסגור חשבוניות פתוחות", "urgent", -1, "new"],
      ["לשלוח הצעת מחיר ללקוח חדש", "high", 0, "new"],
      ["לעדכן את דוח המכירות החודשי", "high", -2, "in_progress"],
      ["לבדוק חוזה ספק", "high", 4, "on_hold", "מחכה לתשובה מהיועץ המשפטי"],
      ["לענות למיילים של לקוחות", "medium", 0, "in_progress"],
      ["פגישת היכרות עם עובד חדש", "medium", 2, "new"],
      ["הדרכת בטיחות לצוות", "medium", 9, "new"],
      ["לתכנן את הרבעון הבא", "medium", 12, "new"],
      ["להזמין ציוד משרדי", "low", 6, "new"],
      ["לעדכן את אתר החברה", "low", null, "on_hold"],
      ["לבקש משוב מלקוחות", "low", 15, "new"],
      ["ישיבת צוות שבועית", "medium", -1, "done"],
      ["לשלוח סיכום פגישה ללקוח", "high", -2, "done"],
      ["לגבות קבצים לענן", "low", -3, "done"],
    ],
  },
  {
    name: "לימודים", color: "#14b8a6", view: "calendar",
    tasks: [
      ["הגשת עבודה בסטטיסטיקה", "urgent", 2, "in_progress"],
      ["להירשם לקורס הבא", "urgent", 4, "new", "ההרשמה נסגרת בסוף השבוע"],
      ["תרגיל בית במתמטיקה", "high", -1, "new"],
      ["מבחן באנגלית", "high", 6, "new"],
      ["פגישה עם המנחה", "high", 8, "new"],
      ["להגיש טופס מלגה", "high", 13, "new"],
      ["הרצאה מקוונת - בינה מלאכותית", "medium", 0, "new"],
      ["לקרוא פרק 4 בספר", "medium", 1, "new"],
      ["לחזור על חומר למבחן", "medium", 5, "new"],
      ["פרויקט קבוצתי - חלוקת משימות", "medium", 10, "new"],
      ["לסכם את שיעור ההיסטוריה", "low", 3, "new"],
      ["להחזיר ספרים לספרייה", "low", -3, "new"],
      ["וובינר על ניהול זמן", "low", 17, "new"],
      ["להכין כרטיסיות לאוצר מילים", "low", -2, "done"],
      ["לצפות בהרצאה מוקלטת", "medium", -1, "done"],
    ],
  },
];

async function main() {
  await sql.unsafe(SCHEMA);
  console.log("schema ready");
  if (!process.argv.includes("--seed")) return;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM spaces`;
  if (count > 0) {
    console.log(`database already has ${count} spaces - skipping seed`);
    return;
  }
  let pos = 0;
  for (const [i, s] of DATA.entries()) {
    const [space] = await sql`INSERT INTO spaces (name, color, view, position) VALUES (${s.name}, ${s.color}, ${s.view}, ${i}) RETURNING id`;
    const rows = s.tasks.map(([title, priority, offset, status, notes], j) => ({
      space_id: space.id,
      title,
      priority,
      status,
      notes: notes ?? "",
      due_date: day(offset),
      position: pos++,
      completed_at: status === "done" ? new Date(Date.now() - (j % 3) * 3600_000 * 20) : null,
    }));
    await sql`INSERT INTO tasks ${sql(rows)}`;
    console.log(`seeded ${s.name}: ${rows.length} tasks`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
