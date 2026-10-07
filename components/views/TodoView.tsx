"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, ListChecks, Plus } from "lucide-react";
import { DueBadge, EmptyState, StatusBadge } from "../ui";
import { useApp } from "../AppShell";
import { PRIORITIES, PRIORITY_META } from "@/lib/constants";
import { createTask, updateTask } from "@/lib/client";
import type { Priority, Space, Task } from "@/lib/types";

const byDue = (a: Task, b: Task) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.id - b.id;

export function TodoView({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { toast } = useApp();
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title.trim();
    setTitle("");
    await createTask({ space_id: space.id, title: t, priority, status: "new", due_date: null, notes: "" }).catch(() => toast("ההוספה נכשלה"));
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={quickAdd} className="flex items-center gap-2 bg-white rounded-2xl border border-line shadow-card p-2 pr-4 mb-6 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition">
        <Plus className="size-5 text-muted shrink-0" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="הוספה מהירה - כתבו משימה ולחצו Enter"
          className="flex-1 min-w-0 outline-none bg-transparent py-1.5 text-sm"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="text-xs font-semibold rounded-lg px-2 py-1.5 outline-none cursor-pointer"
          style={{ color: PRIORITY_META[priority].color, background: PRIORITY_META[priority].bg }}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_META[p].label}</option>
          ))}
        </select>
      </form>

      {open.length === 0 && done.length === 0 && (
        <EmptyState icon={<ListChecks className="size-6" />} title="אין עדיין משימות" text="הוסיפו משימה ראשונה בשורה למעלה, או בקשו מהעוזר שיוסיף בשבילכם." />
      )}
      {open.length === 0 && done.length > 0 && (
        <div className="text-center text-sm text-muted py-8">כל המשימות הושלמו 🎉</div>
      )}

      <div className="space-y-6">
        {PRIORITIES.map((p) => {
          const items = open.filter((t) => t.priority === p).sort(byDue);
          if (!items.length) return null;
          const m = PRIORITY_META[p];
          return (
            <section key={p}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="size-2.5 rounded-full" style={{ background: m.color }} />
                <h3 className="text-sm font-bold" style={{ color: m.color }}>{m.label}</h3>
                <span className="text-xs text-muted tabular-nums">{items.length}</span>
              </div>
              <div className="bg-white rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden">
                {items.map((t) => <Row key={t.id} task={t} />)}
              </div>
            </section>
          );
        })}

        {done.length > 0 && (
          <section>
            <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-2 mb-2 px-1 text-sm font-bold text-muted hover:text-ink">
              <ChevronDown className={clsx("size-4 transition", !showDone && "-rotate-90")} />
              הושלמו
              <span className="text-xs font-normal tabular-nums">{done.length}</span>
            </button>
            {showDone && (
              <div className="bg-white/70 rounded-2xl border border-line divide-y divide-line overflow-hidden animate-fade-in">
                {done.map((t) => <Row key={t.id} task={t} />)}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ task }: { task: Task }) {
  const { openTask } = useApp();
  const done = task.status === "done";
  const m = PRIORITY_META[task.priority];
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition cursor-pointer" onClick={() => openTask(task)}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          updateTask(task.id, { status: done ? "new" : "done" });
        }}
        className={clsx("size-[22px] rounded-full border-2 grid place-items-center shrink-0 transition-all hover:scale-110")}
        style={{ borderColor: m.color, background: done ? m.color : "transparent" }}
        aria-label={done ? "סמן כלא הושלמה" : "סמן כהושלמה"}
      >
        <Check className={clsx("size-3.5 text-white transition", done ? "opacity-100 scale-100" : "opacity-0 scale-50 group-hover:opacity-40")} style={!done ? { color: m.color } : undefined} />
      </button>
      <div className="flex-1 min-w-0">
        <div className={clsx("text-sm truncate transition", done ? "line-through text-slate-400" : "font-medium")}>{task.title}</div>
        {task.notes && <div className="text-xs text-muted truncate mt-0.5">{task.notes}</div>}
      </div>
      {!done && task.status !== "new" && <StatusBadge status={task.status} className="hidden sm:inline-flex" />}
      <DueBadge task={task} className="shrink-0" />
    </div>
  );
}
