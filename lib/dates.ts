import { TIMEZONE } from "./constants";

export const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const HE_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date (YYYY-MM-DD) in Israel time. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function weekday(iso: string): number {
  return parseISO(iso).getUTCDay();
}

/** Sunday that starts the week containing iso (Israeli week). */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekday(iso));
}

export function formatDueLabel(iso: string | null, today = todayISO()): string {
  if (!iso) return "ללא תאריך";
  if (iso === today) return "היום";
  if (iso === addDays(today, 1)) return "מחר";
  if (iso === addDays(today, -1)) return "אתמול";
  const d = parseISO(iso);
  const sameYear = d.getUTCFullYear() === parseISO(today).getUTCFullYear();
  return `${d.getUTCDate()} ב${HE_MONTHS[d.getUTCMonth()]}${sameYear ? "" : ` ${d.getUTCFullYear()}`}`;
}

export function formatLongDate(iso: string): string {
  const d = parseISO(iso);
  return `יום ${HE_DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ב${HE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
