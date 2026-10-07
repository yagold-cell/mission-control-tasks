"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Loader2, Trash2 } from "lucide-react";
import { Modal, SpaceDot, btn } from "./ui";
import { useApp } from "./AppShell";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "@/lib/constants";
import { addDays, formatLongDate, todayISO } from "@/lib/dates";
import { createTask, deleteTask, updateTask, useSpaces } from "@/lib/client";
import type { Priority, Status, Task } from "@/lib/types";

export interface TaskDraft {
  space_id: number | null;
  title: string;
  notes: string;
  priority: Priority;
  status: Status;
  due_date: string | null;
}

export function TaskDialog({ task, defaults, onClose }: { task?: Task; defaults?: Partial<TaskDraft>; onClose: () => void }) {
  const { data: spaces } = useSpaces();
  const { toast } = useApp();
  const pathname = usePathname();
  const routeSpace = Number(pathname.match(/^\/spaces\/(\d+)/)?.[1]) || null;

  const [draft, setDraft] = useState<TaskDraft>(() =>
    task
      ? { space_id: task.space_id, title: task.title, notes: task.notes, priority: task.priority, status: task.status, due_date: task.due_date }
      : {
          space_id: defaults?.space_id ?? routeSpace ?? spaces?.[0]?.id ?? null,
          title: "",
          notes: "",
          priority: "medium",
          status: "new",
          due_date: null,
          ...defaults,
        },
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const spaceId = draft.space_id ?? spaces?.[0]?.id ?? null;
  const today = todayISO();

  async function save() {
    if (!draft.title.trim() || !spaceId) return;
    setSaving(true);
    try {
      const payload = { ...draft, title: draft.title.trim(), space_id: spaceId };
      if (task) {
        await updateTask(task.id, payload);
        toast("המשימה עודכנה");
      } else {
        await createTask(payload);
        toast("המשימה נוספה");
      }
      onClose();
    } catch {
      toast("השמירה נכשלה, נסה שוב");
      setSaving(false);
    }
  }

  async function remove() {
    if (!task) return;
    onClose();
    await deleteTask(task.id).then(() => toast("המשימה נמחקה"), () => toast("המחיקה נכשלה"));
  }

  const quickDates = [
    { label: "היום", value: today },
    { label: "מחר", value: addDays(today, 1) },
    { label: "בעוד שבוע", value: addDays(today, 7) },
    { label: "ללא", value: null },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? "כרטיס משימה" : "משימה חדשה"}
      footer={
        <>
          <button className={btn.primary} onClick={save} disabled={saving || !draft.title.trim() || !spaceId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {task ? "שמירה" : "הוספת משימה"}
          </button>
          <button className={btn.ghost} onClick={onClose}>ביטול</button>
          <div className="flex-1" />
          {task &&
            (confirmDelete ? (
              <div className="flex items-center gap-1 animate-fade-in">
                <span className="text-sm text-muted">למחוק?</span>
                <button className={clsx(btn.danger, "bg-red-50")} onClick={remove}>כן, מחיקה</button>
                <button className={btn.ghost} onClick={() => setConfirmDelete(false)}>לא</button>
              </div>
            ) : (
              <button className={btn.danger} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                מחיקה
              </button>
            ))}
        </>
      }
    >
      <div className="space-y-5">
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && save()}
          placeholder="מה צריך לעשות?"
          className="w-full text-lg font-semibold border-0 border-b-2 border-line focus:border-brand outline-none py-2 bg-transparent transition placeholder:text-slate-300"
        />

        <Field label="עדיפות">
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.slice().reverse().map((p) => {
              const m = PRIORITY_META[p];
              const active = draft.priority === p;
              return (
                <button
                  key={p}
                  onClick={() => set("priority", p)}
                  className={clsx("rounded-xl py-2 text-sm font-semibold border-2 transition", active ? "shadow-sm" : "border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100")}
                  style={active ? { borderColor: m.color, color: m.color, background: m.bg } : undefined}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="סטטוס">
          <div className="grid grid-cols-4 gap-1.5">
            {STATUSES.map((s) => {
              const m = STATUS_META[s];
              const active = draft.status === s;
              return (
                <button
                  key={s}
                  onClick={() => set("status", s)}
                  className={clsx("rounded-xl py-2 text-sm font-semibold border-2 transition", active ? "shadow-sm" : "border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100")}
                  style={active ? { borderColor: m.color, color: m.color, background: m.bg } : undefined}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="תאריך יעד">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="date"
              value={draft.due_date ?? ""}
              onChange={(e) => set("due_date", e.target.value || null)}
              className="rounded-xl border border-line px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
            {quickDates.map((q) => (
              <button
                key={q.label}
                onClick={() => set("due_date", q.value)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  draft.due_date === q.value ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          {draft.due_date && <div className="text-xs text-muted mt-1.5">{formatLongDate(draft.due_date)}</div>}
        </Field>

        <Field label="מרחב">
          <div className="flex flex-wrap gap-1.5">
            {spaces?.map((s) => (
              <button
                key={s.id}
                onClick={() => set("space_id", s.id)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition",
                  spaceId === s.id ? "font-semibold" : "border-line text-slate-600 hover:bg-slate-50",
                )}
                style={spaceId === s.id ? { borderColor: s.color, background: s.color + "14", color: s.color } : undefined}
              >
                <SpaceDot color={s.color} />
                {s.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="הערות">
          <textarea
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="פרטים נוספים (לא חובה)"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 resize-none"
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted mb-2">{label}</div>
      {children}
    </div>
  );
}
