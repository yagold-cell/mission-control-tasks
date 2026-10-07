"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, CheckCheck, Columns3, LayoutDashboard, ListChecks, LogOut, Plus, X } from "lucide-react";
import { useSpaces, useTasks } from "@/lib/client";
import { useApp } from "./AppShell";
import type { ViewType } from "@/lib/types";

export const VIEW_ICON: Record<ViewType, typeof Columns3> = { kanban: Columns3, todo: ListChecks, calendar: CalendarDays };

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data: spaces } = useSpaces();
  const { data: tasks } = useTasks();
  const { openSpaceDialog } = useApp();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const openCount = (id: number) => tasks?.filter((t) => t.space_id === id && t.status !== "done").length ?? 0;

  const nav = (
    <aside className="h-dvh w-72 lg:w-64 shrink-0 bg-white border-l border-line flex flex-col">
      <div className="flex items-center gap-2.5 px-5 h-16">
        <div className="size-9 rounded-xl bg-brand text-white grid place-items-center shadow-md shadow-brand/30">
          <CheckCheck className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold leading-5">מרחבים</div>
          <div className="text-[11px] text-muted">ניהול משימות חכם</div>
        </div>
        <button onClick={logout} title="יציאה" className="p-2 rounded-lg text-muted hover:bg-slate-100 hover:text-ink">
          <LogOut className="size-4" />
        </button>
        <button onClick={onClose} className="lg:hidden p-2 rounded-lg text-muted hover:bg-slate-100" aria-label="סגירה">
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-28">
        <Link
          href="/"
          onClick={onClose}
          className={clsx(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            pathname === "/" ? "bg-brand-soft text-brand" : "text-slate-700 hover:bg-slate-50",
          )}
        >
          <LayoutDashboard className="size-[18px]" />
          דשבורד
        </Link>

        <div className="mt-6 mb-2 px-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted tracking-wide">המרחבים שלי</span>
          <button onClick={() => openSpaceDialog()} className="p-1 rounded-md text-muted hover:bg-slate-100 hover:text-brand" title="מרחב חדש">
            <Plus className="size-4" />
          </button>
        </div>

        <div className="space-y-0.5">
          {spaces?.map((s) => {
            const active = pathname === `/spaces/${s.id}`;
            const Icon = VIEW_ICON[s.view];
            return (
              <Link
                key={s.id}
                href={`/spaces/${s.id}`}
                onClick={onClose}
                className={clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition relative",
                  active ? "bg-slate-100 font-semibold" : "text-slate-700 hover:bg-slate-50",
                )}
              >
                {active && <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full" style={{ background: s.color }} />}
                <span className="size-7 rounded-lg grid place-items-center shrink-0" style={{ background: s.color + "1f", color: s.color }}>
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-[11px] text-muted tabular-nums">{openCount(s.id) || ""}</span>
              </Link>
            );
          })}
          {!spaces && [0, 1, 2].map((i) => <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse my-1" />)}
        </div>

        <button
          onClick={() => openSpaceDialog()}
          className="mt-3 w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted border border-dashed border-line hover:border-brand hover:text-brand transition"
        >
          <Plus className="size-4" />
          מרחב חדש
        </button>
      </nav>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block sticky top-0 h-dvh">{nav}</div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40 animate-fade-in" onClick={onClose} />
          <div className="absolute inset-y-0 right-0 animate-slide-up">{nav}</div>
        </div>
      )}
    </>
  );
}
