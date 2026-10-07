"use client";

import Link from "next/link";
import clsx from "clsx";
import { Loader2, Plus, Settings2 } from "lucide-react";
import { useSpaces, useTasks, updateSpace } from "@/lib/client";
import { VIEWS, VIEW_META } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { useApp } from "./AppShell";
import { VIEW_ICON } from "./Sidebar";
import { btn } from "./ui";
import { KanbanView } from "./views/KanbanView";
import { TodoView } from "./views/TodoView";
import { CalendarView } from "./views/CalendarView";

export function SpacePage({ id }: { id: number }) {
  const { data: spaces } = useSpaces();
  const { data: allTasks } = useTasks();
  const { newTask, openSpaceDialog } = useApp();
  const space = spaces?.find((s) => s.id === id);

  if (!spaces || !allTasks) {
    return (
      <div className="h-[60vh] grid place-items-center text-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (!space) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted">המרחב לא נמצא.</p>
        <Link href="/" className="text-brand font-semibold text-sm">חזרה לדשבורד</Link>
      </div>
    );
  }

  const tasks = allTasks.filter((t) => t.space_id === id);
  const today = todayISO();
  const open = tasks.filter((t) => t.status !== "done").length;
  const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
  const Icon = VIEW_ICON[space.view];

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-28">
      <header className="flex flex-wrap items-center gap-3 mb-6">
        <div className="size-11 rounded-2xl grid place-items-center shrink-0" style={{ background: space.color + "1f", color: space.color }}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold truncate flex items-center gap-2">
            {space.name}
            <button onClick={() => openSpaceDialog(space)} className="p-1.5 rounded-lg text-muted hover:bg-white hover:text-ink" title="הגדרות מרחב">
              <Settings2 className="size-4" />
            </button>
          </h1>
          <p className="text-sm text-muted">
            {open} פתוחות{overdue > 0 && <span className="text-red-600"> · {overdue} באיחור</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-white border border-line rounded-xl p-1 shadow-card flex-1 sm:flex-none">
            {VIEWS.map((v) => {
              const VIcon = VIEW_ICON[v];
              const active = space.view === v;
              return (
                <button
                  key={v}
                  onClick={() => !active && updateSpace(space.id, { view: v })}
                  className={clsx(
                    "flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    active ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
                  )}
                  style={active ? { background: space.color } : undefined}
                >
                  <VIcon className="size-4" />
                  <span>{VIEW_META[v].label === "רשימת משימות" ? "רשימה" : VIEW_META[v].label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => newTask({ space_id: space.id })} className={btn.primary}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">משימה חדשה</span>
          </button>
        </div>
      </header>

      {space.view === "kanban" && <KanbanView space={space} tasks={tasks} />}
      {space.view === "todo" && <TodoView space={space} tasks={tasks} />}
      {space.view === "calendar" && <CalendarView space={space} tasks={tasks} />}
    </div>
  );
}
