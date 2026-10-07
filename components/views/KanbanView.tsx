"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignRight, Plus } from "lucide-react";
import { DueBadge, PriorityBadge } from "../ui";
import { useApp } from "../AppShell";
import { STATUSES, STATUS_META } from "@/lib/constants";
import { reorderColumn } from "@/lib/client";
import type { Space, Status, Task } from "@/lib/types";

type Columns = Record<Status, number[]>;

function buildColumns(tasks: Task[]): Columns {
  const cols: Columns = { new: [], in_progress: [], on_hold: [], done: [] };
  [...tasks].sort((a, b) => a.position - b.position || a.id - b.id).forEach((t) => cols[t.status].push(t.id));
  return cols;
}

export function KanbanView({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { newTask } = useApp();
  const [cols, setCols] = useState<Columns>(() => buildColumns(tasks));
  const [activeId, setActiveId] = useState<number | null>(null);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  useEffect(() => {
    if (activeId === null) setCols(buildColumns(tasks));
  }, [tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: UniqueIdentifier, c: Columns = cols): Status | undefined =>
    (STATUSES as UniqueIdentifier[]).includes(id) ? (id as Status) : STATUSES.find((s) => c[s].includes(id as number));

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as number);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;
    setCols((prev) => {
      const toItems = [...prev[to]];
      const overIndex = toItems.indexOf(over.id as number);
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, active.id as number);
      return { ...prev, [from]: prev[from].filter((x) => x !== active.id), [to]: toItems };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = active.id as number;
    const to = over ? findContainer(over.id) : undefined;
    const container = findContainer(id);
    setActiveId(null);
    if (!to || !container) {
      setCols(buildColumns(tasks));
      return;
    }
    let next = cols;
    const items = cols[container];
    const oldIndex = items.indexOf(id);
    const newIndex = (STATUSES as UniqueIdentifier[]).includes(over!.id) ? items.length - 1 : items.indexOf(over!.id as number);
    if (oldIndex !== newIndex && newIndex >= 0) next = { ...cols, [container]: arrayMove(items, oldIndex, newIndex) };
    setCols(next);

    const original = byId.get(id);
    const originalOrder = buildColumns(tasks)[container];
    const changed = original?.status !== container || originalOrder.join() !== next[container].join();
    if (changed) reorderColumn(container, next[container]);
  }

  const active = activeId !== null ? byId.get(activeId) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex lg:grid lg:grid-cols-4 gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x scroll-thin">
        {STATUSES.map((status) => (
          <Column key={status} status={status} ids={cols[status]} byId={byId} onAdd={() => newTask({ space_id: space.id, status })} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" }}>
        {active ? <Card task={active} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, ids, byId, onAdd }: { status: Status; ids: number[]; byId: Map<number, Task>; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const m = STATUS_META[status];
  return (
    <div className="w-[78vw] sm:w-72 lg:w-auto shrink-0 snap-start flex flex-col rounded-2xl bg-slate-100/70 border border-line/60">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="size-2.5 rounded-full" style={{ background: m.color }} />
        <span className="font-semibold text-sm">{m.label}</span>
        <span className="text-xs text-muted bg-white rounded-full px-2 py-0.5 tabular-nums">{ids.length}</span>
        <div className="flex-1" />
        <button onClick={onAdd} className="p-1 rounded-md text-muted hover:bg-white hover:text-brand" title="משימה חדשה בעמודה">
          <Plus className="size-4" />
        </button>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={clsx("flex-1 min-h-40 space-y-2 p-2 pt-1 rounded-b-2xl transition-colors", isOver && "bg-brand-soft/60")}
        >
          {ids.map((id) => {
            const t = byId.get(id);
            return t ? <SortableCard key={id} task={t} /> : null;
          })}
          {ids.length === 0 && (
            <div className="h-24 grid place-items-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              גררו לכאן משימות
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <Card task={task} />
    </div>
  );
}

function Card({ task, dragging }: { task: Task; dragging?: boolean }) {
  const { openTask } = useApp();
  const done = task.status === "done";
  return (
    <div
      onClick={() => !dragging && openTask(task)}
      className={clsx(
        "group bg-white rounded-xl p-3 border border-line/80 shadow-card cursor-grab active:cursor-grabbing hover:border-slate-300 hover:shadow-md transition select-none",
        dragging && "shadow-pop rotate-2 scale-[1.02] cursor-grabbing",
      )}
    >
      <div className={clsx("text-sm font-medium leading-5", done && "line-through text-slate-400")}>{task.title}</div>
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <PriorityBadge priority={task.priority} />
        <DueBadge task={task} />
        {task.notes && <AlignRight className="size-3.5 text-slate-400" />}
      </div>
    </div>
  );
}
