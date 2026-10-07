"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Modal, PriorityBadge, StatusBadge, btn } from "../ui";
import { useApp } from "../AppShell";
import { PRIORITY_META } from "@/lib/constants";
import { HE_DAYS_SHORT, HE_MONTHS, addDays, formatLongDate, parseISO, todayISO, toISO } from "@/lib/dates";
import { updateTask } from "@/lib/client";
import type { Space, Task } from "@/lib/types";

const MAX_CHIPS = 3;

export function CalendarView({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { newTask } = useApp();
  const today = todayISO();
  const [month, setMonth] = useState(() => {
    const d = parseISO(today);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });
  const [dayPanel, setDayPanel] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const days = useMemo(() => {
    const first = toISO(new Date(Date.UTC(month.y, month.m, 1)));
    const start = addDays(first, -parseISO(first).getUTCDay());
    const daysInMonth = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
    const weeks = Math.ceil((parseISO(first).getUTCDay() + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const list = map.get(t.due_date) ?? [];
      list.push(t);
      map.set(t.due_date, list);
    }
    for (const list of map.values())
      list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank);
    return map;
  }, [tasks]);

  const undated = tasks.filter((t) => !t.due_date && t.status !== "done");

  const shift = (delta: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  const goToday = () => {
    const d = parseISO(today);
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  function onDrop(e: React.DragEvent, iso: string) {
    e.preventDefault();
    setDropTarget(null);
    const id = Number(e.dataTransfer.getData("text/task-id"));
    const t = tasks.find((x) => x.id === id);
    if (t && t.due_date !== iso) updateTask(id, { due_date: iso });
  }

  function onCellClick(iso: string) {
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    if (isMobile && byDate.get(iso)?.length) setDayPanel(iso);
    else newTask({ space_id: space.id, due_date: iso });
  }

  return (
    <div className="flex flex-col 2xl:flex-row gap-5">
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <h2 className="text-lg font-bold min-w-36">{HE_MONTHS[month.m]} {month.y}</h2>
          <div className="flex items-center">
            <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="החודש הקודם">
              <ChevronRight className="size-5" />
            </button>
            <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="החודש הבא">
              <ChevronLeft className="size-5" />
            </button>
          </div>
          <button onClick={goToday} className={clsx(btn.outline, "py-1.5 text-xs")}>היום</button>
          <div className="flex-1" />
          <span className="hidden md:inline text-xs text-muted">לחצו על יום להוספת משימה · גררו משימה כדי לשנות תאריך</span>
        </div>

        <div className="grid grid-cols-7 border-b border-line bg-slate-50/60">
          {HE_DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-muted py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((iso, i) => {
            const d = parseISO(iso);
            const inMonth = d.getUTCMonth() === month.m;
            const isToday = iso === today;
            const list = byDate.get(iso) ?? [];
            const extra = list.length - MAX_CHIPS;
            return (
              <div
                key={iso}
                onClick={() => onCellClick(iso)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(iso);
                }}
                onDragLeave={() => setDropTarget((t) => (t === iso ? null : t))}
                onDrop={(e) => onDrop(e, iso)}
                className={clsx(
                  "group relative min-h-[76px] sm:min-h-[118px] p-1 sm:p-1.5 border-line cursor-pointer transition-colors",
                  i % 7 !== 6 && "border-l",
                  i < days.length - 7 && "border-b",
                  inMonth ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/50",
                  dropTarget === iso && "!bg-brand-soft ring-2 ring-inset ring-brand/40",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={clsx(
                      "size-6 sm:size-7 grid place-items-center rounded-full text-xs sm:text-[13px] tabular-nums",
                      isToday ? "bg-brand text-white font-bold" : inMonth ? "text-slate-700 font-medium" : "text-slate-300",
                    )}
                  >
                    {d.getUTCDate()}
                  </span>
                  <Plus className="size-4 text-slate-300 opacity-0 group-hover:opacity-100 transition hidden sm:block" />
                </div>

                {/* desktop chips */}
                <div className="hidden sm:block space-y-1">
                  {list.slice(0, MAX_CHIPS).map((t) => <Chip key={t.id} task={t} />)}
                  {extra > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDayPanel(iso);
                      }}
                      className="w-full text-right text-[11px] font-semibold text-muted hover:text-brand px-1.5"
                    >
                      +{extra} נוספות
                    </button>
                  )}
                </div>
                {/* mobile dots */}
                <div className="sm:hidden flex flex-wrap gap-0.5 px-0.5">
                  {list.slice(0, 6).map((t) => (
                    <span key={t.id} className={clsx("size-1.5 rounded-full", t.status === "done" && "opacity-30")} style={{ background: PRIORITY_META[t.priority].color }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="2xl:w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-line shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">ללא תאריך</h3>
            <span className="text-xs text-muted tabular-nums">{undated.length}</span>
          </div>
          {undated.length === 0 ? (
            <p className="text-xs text-muted">לכל המשימות הפתוחות יש תאריך יעד 👌</p>
          ) : (
            <div className="space-y-1.5">
              {undated.map((t) => <Chip key={t.id} task={t} large />)}
              <p className="text-[11px] text-muted pt-1">גררו משימה ליום בלוח כדי לקבוע לה תאריך</p>
            </div>
          )}
          <button onClick={() => newTask({ space_id: space.id })} className={clsx(btn.outline, "w-full mt-3 text-xs")}>
            <Plus className="size-3.5" />
            משימה ללא תאריך
          </button>
        </div>
      </aside>

      {dayPanel && (
        <Modal open onClose={() => setDayPanel(null)} title={formatLongDate(dayPanel)} width="max-w-md">
          <div className="space-y-2">
            {(byDate.get(dayPanel) ?? []).map((t) => <DayRow key={t.id} task={t} onOpen={() => setDayPanel(null)} />)}
          </div>
          <button
            onClick={() => {
              const iso = dayPanel;
              setDayPanel(null);
              newTask({ space_id: space.id, due_date: iso });
            }}
            className={clsx(btn.primary, "w-full mt-4")}
          >
            <Plus className="size-4" />
            משימה חדשה ביום הזה
          </button>
        </Modal>
      )}
    </div>
  );
}

function Chip({ task, large }: { task: Task; large?: boolean }) {
  const { openTask } = useApp();
  const m = PRIORITY_META[task.priority];
  const done = task.status === "done";
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", String(task.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        openTask(task);
      }}
      title={task.title}
      className={clsx(
        "truncate rounded-md border-r-[3px] cursor-pointer hover:brightness-95 hover:shadow-sm transition",
        large ? "text-xs px-2 py-1.5" : "text-[11px] leading-4 px-1.5 py-0.5",
        done && "opacity-50 line-through",
      )}
      style={{ background: m.bg, borderColor: m.color, color: "#1e293b" }}
    >
      {task.title}
    </div>
  );
}

function DayRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { openTask } = useApp();
  return (
    <button
      onClick={() => {
        onOpen();
        openTask(task);
      }}
      className="w-full flex items-center gap-2 text-right rounded-xl border border-line px-3 py-2.5 hover:bg-slate-50 transition"
    >
      <span className="w-1 self-stretch rounded-full" style={{ background: PRIORITY_META[task.priority].color }} />
      <span className={clsx("flex-1 text-sm truncate", task.status === "done" && "line-through text-slate-400")}>{task.title}</span>
      <PriorityBadge priority={task.priority} />
      <StatusBadge status={task.status} />
    </button>
  );
}
