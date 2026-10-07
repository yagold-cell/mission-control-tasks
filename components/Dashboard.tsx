"use client";

import Link from "next/link";
import clsx from "clsx";
import { AlarmClock, ArrowLeft, Check, Flame, Loader2, Plus, Sun } from "lucide-react";
import { saveDashboardSpaces, updateTask, useSettings, useSpaces, useTasks } from "@/lib/client";
import { PRIORITY_META } from "@/lib/constants";
import { formatLongDate, startOfWeek, todayISO } from "@/lib/dates";
import { useApp } from "./AppShell";
import { VIEW_ICON } from "./Sidebar";
import { DueBadge, PriorityBadge, SpaceDot, btn } from "./ui";
import type { Space, Task } from "@/lib/types";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "numeric", hour12: false }).format(new Date()));
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

export function Dashboard() {
  const { data: spaces } = useSpaces();
  const { data: tasks } = useTasks();
  const { data: settings } = useSettings();
  const { openSpaceDialog, newTask } = useApp();

  if (!spaces || !tasks || !settings) {
    return (
      <div className="h-[60vh] grid place-items-center text-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const today = todayISO();
  const weekStart = startOfWeek(today);
  const saved = settings.dashboardSpaces;
  const selected = saved === null ? spaces.map((s) => s.id) : saved.filter((id) => spaces.some((s) => s.id === id));
  const selectedSet = new Set(selected);
  const spaceById = new Map(spaces.map((s) => [s.id, s]));

  const toggle = (id: number) => {
    const next = selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id];
    saveDashboardSpaces(next);
  };
  const allSelected = selected.length === spaces.length;

  const visible = tasks.filter((t) => selectedSet.has(t.space_id) && t.status !== "done");
  const byPriorityThenDue = (a: Task, b: Task) =>
    PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  const urgent = visible.filter((t) => t.priority === "urgent").sort(byPriorityThenDue);
  const dueToday = visible.filter((t) => t.due_date === today).sort(byPriorityThenDue);
  const overdue = visible.filter((t) => t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28 max-w-7xl">
      <header className="mb-6">
        <p className="text-sm text-muted">{formatLongDate(today)}</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-0.5">{greeting()} 👋</h1>
      </header>

      {/* space selector */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <span className="text-xs font-semibold text-muted ml-1">מציג:</span>
        <button
          onClick={() => saveDashboardSpaces(allSelected ? [] : spaces.map((s) => s.id))}
          className={clsx(
            "rounded-full px-3.5 py-1.5 text-sm font-medium border transition",
            allSelected ? "bg-ink text-white border-ink" : "bg-white border-line text-slate-600 hover:bg-slate-50",
          )}
        >
          כל המרחבים
        </button>
        {spaces.map((s) => {
          const on = selectedSet.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium border transition",
                on ? "shadow-sm" : "bg-white border-line text-slate-400 hover:text-slate-600",
              )}
              style={on ? { background: s.color + "17", borderColor: s.color + "66", color: s.color } : undefined}
            >
              <span className={clsx("size-4 rounded-full grid place-items-center transition", !on && "border-2 border-slate-300")} style={on ? { background: s.color } : undefined}>
                {on && <Check className="size-2.5 text-white" strokeWidth={4} />}
              </span>
              {s.name}
            </button>
          );
        })}
      </div>

      {spaces.length === 0 ? (
        <div className="bg-white rounded-2xl border border-line p-10 text-center">
          <p className="font-semibold">עוד אין מרחבים</p>
          <p className="text-sm text-muted mt-1">צרו מרחב ראשון כדי להתחיל לנהל משימות</p>
          <button onClick={() => openSpaceDialog()} className={clsx(btn.primary, "mt-4")}>
            <Plus className="size-4" /> מרחב חדש
          </button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-10">
            <TaskGroup title="דחוף" icon={<Flame className="size-4" />} color="#dc2626" tasks={urgent} spaceById={spaceById} empty="אין משימות דחופות 🙌" />
            <TaskGroup title="להיום" icon={<Sun className="size-4" />} color="#d97706" tasks={dueToday} spaceById={spaceById} empty="אין משימות להיום" onAdd={() => newTask({ due_date: today, space_id: selected[0] })} />
            <TaskGroup title="באיחור" icon={<AlarmClock className="size-4" />} color="#9333ea" tasks={overdue} spaceById={spaceById} empty="שום דבר לא באיחור ✨" />
          </div>

          <h2 className="text-lg font-bold mb-3">המרחבים</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {spaces.filter((s) => selectedSet.has(s.id)).map((s) => {
              const st = tasks.filter((t) => t.space_id === s.id);
              return (
                <SpaceCard
                  key={s.id}
                  space={s}
                  open={st.filter((t) => t.status !== "done").length}
                  overdue={st.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length}
                  closedWeek={st.filter((t) => t.status === "done" && t.completed_at && todayISO(new Date(t.completed_at)) >= weekStart).length}
                />
              );
            })}
            <button
              onClick={() => openSpaceDialog()}
              className="rounded-2xl border-2 border-dashed border-line text-muted hover:border-brand hover:text-brand transition grid place-items-center min-h-36 text-sm font-medium"
            >
              <span className="flex items-center gap-2"><Plus className="size-4" /> מרחב חדש</span>
            </button>
          </div>
          {selected.length === 0 && <p className="text-sm text-muted mt-4">בחרו לפחות מרחב אחד למעלה כדי לראות משימות.</p>}
        </>
      )}
    </div>
  );
}

function TaskGroup({
  title, icon, color, tasks, spaceById, empty, onAdd,
}: {
  title: string; icon: React.ReactNode; color: string; tasks: Task[]; spaceById: Map<number, Space>; empty: string; onAdd?: () => void;
}) {
  const { openTask } = useApp();
  return (
    <section className="bg-white rounded-2xl border border-line shadow-card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <span className="size-7 rounded-lg grid place-items-center" style={{ background: color + "17", color }}>{icon}</span>
        <h3 className="font-bold">{title}</h3>
        <span className="text-xs font-semibold rounded-full px-2 py-0.5 tabular-nums" style={{ background: color + "17", color }}>{tasks.length}</span>
        <div className="flex-1" />
        {onAdd && (
          <button onClick={onAdd} className="p-1 rounded-md text-muted hover:bg-slate-100 hover:text-brand" title="משימה להיום">
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div className="flex-1 max-h-96 overflow-y-auto scroll-thin divide-y divide-line">
        {tasks.length === 0 && <p className="text-sm text-muted text-center py-10">{empty}</p>}
        {tasks.map((t) => {
          const s = spaceById.get(t.space_id);
          return (
            <div key={t.id} onClick={() => openTask(t)} className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 cursor-pointer transition">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(t.id, { status: "done" });
                }}
                className="mt-0.5 size-[18px] rounded-full border-2 grid place-items-center shrink-0 hover:scale-110 transition"
                style={{ borderColor: PRIORITY_META[t.priority].color }}
                title="סמן כהושלמה"
              >
                <Check className="size-3 opacity-0 group-hover:opacity-50" style={{ color: PRIORITY_META[t.priority].color }} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-5">{t.title}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {s && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <SpaceDot color={s.color} className="size-2" />
                      {s.name}
                    </span>
                  )}
                  {t.priority !== "urgent" && <PriorityBadge priority={t.priority} />}
                  <DueBadge task={t} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SpaceCard({ space, open, overdue, closedWeek }: { space: Space; open: number; overdue: number; closedWeek: number }) {
  const Icon = VIEW_ICON[space.view];
  return (
    <Link href={`/spaces/${space.id}`} className="group relative bg-white rounded-2xl border border-line shadow-card p-4 hover:shadow-md hover:-translate-y-0.5 transition overflow-hidden">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: space.color }} />
      <div className="flex items-center gap-2.5 mb-4">
        <span className="size-9 rounded-xl grid place-items-center" style={{ background: space.color + "1f", color: space.color }}>
          <Icon className="size-[18px]" />
        </span>
        <span className="font-bold flex-1 truncate">{space.name}</span>
        <ArrowLeft className="size-4 text-slate-300 group-hover:text-slate-500 group-hover:-translate-x-0.5 transition" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={open} label="פתוחות" />
        <Stat value={overdue} label="באיחור" danger={overdue > 0} />
        <Stat value={closedWeek} label="נסגרו השבוע" good={closedWeek > 0} />
      </div>
    </Link>
  );
}

function Stat({ value, label, danger, good }: { value: number; label: string; danger?: boolean; good?: boolean }) {
  return (
    <div className={clsx("rounded-xl py-2", danger ? "bg-red-50" : good ? "bg-emerald-50" : "bg-slate-50")}>
      <div className={clsx("text-xl font-extrabold tabular-nums", danger ? "text-red-600" : good ? "text-emerald-600" : "text-ink")}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
