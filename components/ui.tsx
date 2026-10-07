"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { CalendarDays, X } from "lucide-react";
import { PRIORITY_META, STATUS_META } from "@/lib/constants";
import { formatDueLabel, todayISO } from "@/lib/dates";
import type { Priority, Status, Task } from "@/lib/types";

export function Modal({
  open, onClose, title, children, footer, width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={clsx("relative w-full bg-white rounded-t-3xl sm:rounded-2xl shadow-pop animate-pop-in max-h-[92dvh] flex flex-col", width)} role="dialog" aria-modal>
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div className="text-lg font-bold min-w-0">{title}</div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted" aria-label="סגירה">
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto scroll-thin">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line flex items-center gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const m = PRIORITY_META[priority];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4", className)} style={{ color: m.color, background: m.bg }}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4", className)} style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

export function isOverdue(t: Pick<Task, "due_date" | "status">, today = todayISO()) {
  return !!t.due_date && t.due_date < today && t.status !== "done";
}

export function DueBadge({ task, className }: { task: Pick<Task, "due_date" | "status">; className?: string }) {
  if (!task.due_date) return null;
  const today = todayISO();
  const overdue = isOverdue(task, today);
  const isToday = task.due_date === today && task.status !== "done";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-[11px] font-medium",
        overdue ? "text-red-600" : isToday ? "text-amber-600" : "text-muted",
        className,
      )}
    >
      <CalendarDays className="size-3" />
      {formatDueLabel(task.due_date, today)}
      {overdue && " · באיחור"}
    </span>
  );
}

export function SpaceDot({ color, className }: { color: string; className?: string }) {
  return <span className={clsx("inline-block size-2.5 rounded-full shrink-0", className)} style={{ background: color }} />;
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="size-12 rounded-2xl bg-brand-soft text-brand grid place-items-center mb-3">{icon}</div>
      <div className="font-semibold">{title}</div>
      {text && <div className="text-sm text-muted mt-1 max-w-xs">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-sm px-4 py-2 transition shadow-sm shadow-brand/30 disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-xl hover:bg-slate-100 text-slate-700 font-medium text-sm px-3 py-2 transition",
  outline: "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm px-3 py-2 transition",
  danger: "inline-flex items-center justify-center gap-1.5 rounded-xl text-red-600 hover:bg-red-50 font-medium text-sm px-3 py-2 transition",
};
