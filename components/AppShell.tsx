"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TaskDialog, type TaskDraft } from "./TaskDialog";
import { SpaceDialog } from "./SpaceDialog";
import { AgentWidget } from "./AgentWidget";
import type { Space, Task } from "@/lib/types";

interface AppCtx {
  openTask: (task: Task) => void;
  newTask: (defaults?: Partial<TaskDraft>) => void;
  openSpaceDialog: (space?: Space) => void;
  toast: (message: string) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppShell");
  return c;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [taskState, setTaskState] = useState<{ task?: Task; defaults?: Partial<TaskDraft>; key: number } | null>(null);
  const [spaceState, setSpaceState] = useState<{ space?: Space; key: number } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [navOpen, setNavOpen] = useState(false);

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const value: AppCtx = {
    openTask: (task) => setTaskState({ task, key: Date.now() }),
    newTask: (defaults) => setTaskState({ defaults, key: Date.now() }),
    openSpaceDialog: (space) => setSpaceState({ space, key: Date.now() }),
    toast,
  };

  return (
    <Ctx.Provider value={value}>
      <div className="min-h-dvh lg:flex">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2 bg-white/90 backdrop-blur border-b border-line px-3 py-2.5">
            <button onClick={() => setNavOpen(true)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="תפריט">
              <Menu className="size-5" />
            </button>
            <span className="font-bold">מרחבים</span>
          </div>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>

      {taskState && <TaskDialog key={taskState.key} task={taskState.task} defaults={taskState.defaults} onClose={() => setTaskState(null)} />}
      {spaceState && <SpaceDialog key={spaceState.key} space={spaceState.space} onClose={() => setSpaceState(null)} />}
      <AgentWidget />

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="bg-slate-900 text-white text-sm rounded-xl px-4 py-2.5 shadow-pop animate-slide-up">
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
