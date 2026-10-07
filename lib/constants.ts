import type { Priority, Status, ViewType } from "./types";

export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
export const STATUSES: Status[] = ["new", "in_progress", "on_hold", "done"];
export const VIEWS: ViewType[] = ["kanban", "todo", "calendar"];

export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; rank: number }> = {
  urgent: { label: "דחוף", color: "#dc2626", bg: "#fee2e2", rank: 4 },
  high: { label: "גבוהה", color: "#ea580c", bg: "#ffedd5", rank: 3 },
  medium: { label: "בינונית", color: "#2563eb", bg: "#dbeafe", rank: 2 },
  low: { label: "נמוכה", color: "#64748b", bg: "#f1f5f9", rank: 1 },
};

export const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  new: { label: "חדשה", color: "#7c3aed", bg: "#ede9fe" },
  in_progress: { label: "בעבודה", color: "#0891b2", bg: "#cffafe" },
  on_hold: { label: "בהשהייה", color: "#b45309", bg: "#fef3c7" },
  done: { label: "הושלמה", color: "#059669", bg: "#d1fae5" },
};

export const VIEW_META: Record<ViewType, { label: string; description: string }> = {
  kanban: { label: "קנבן", description: "עמודות לפי סטטוס, גרירה ושחרור" },
  todo: { label: "רשימת משימות", description: "רשימה עם וי, ממוינת לפי עדיפות" },
  calendar: { label: "לוח שנה", description: "חודש מלא, משימות לפי תאריך יעד" },
};

export const SPACE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#64748b", "#a16207",
];

export const TIMEZONE = "Asia/Jerusalem";
