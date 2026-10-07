"use client";

import useSWR, { mutate } from "swr";
import type { Space, Status, Task } from "./types";

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "שגיאה"), { data });
  return data as T;
}

const fetcher = <T,>(url: string) => api<T>(url);

export const KEYS = { spaces: "/api/spaces", tasks: "/api/tasks", settings: "/api/settings" };

export function useSpaces() {
  return useSWR<Space[]>(KEYS.spaces, fetcher);
}
export function useTasks() {
  return useSWR<Task[]>(KEYS.tasks, fetcher);
}
export function useSettings() {
  return useSWR<{ dashboardSpaces: number[] | null }>(KEYS.settings, fetcher);
}

export function refreshAll() {
  return Promise.all([mutate(KEYS.spaces), mutate(KEYS.tasks), mutate(KEYS.settings)]);
}

// ---------- task mutations (optimistic) ----------
type TaskPatch = Partial<Pick<Task, "title" | "notes" | "priority" | "status" | "due_date" | "space_id" | "position">>;

function applyPatch(t: Task, patch: TaskPatch): Task {
  const next = { ...t, ...patch };
  if (patch.status && patch.status !== t.status) {
    next.completed_at = patch.status === "done" ? new Date().toISOString() : null;
  }
  return next;
}

export async function updateTask(id: number, patch: TaskPatch) {
  await mutate<Task[]>(
    KEYS.tasks,
    async (current) => {
      const saved = await api<Task>(`/api/tasks/${id}`, { method: "PATCH", body: patch });
      return (current ?? []).map((t) => (t.id === id ? saved : t));
    },
    {
      optimisticData: (current) => (current ?? []).map((t) => (t.id === id ? applyPatch(t, patch) : t)),
      rollbackOnError: true,
      revalidate: false,
    },
  );
}

export async function createTask(input: Pick<Task, "space_id" | "title" | "priority" | "status" | "due_date" | "notes">) {
  const saved = await api<Task>("/api/tasks", { method: "POST", body: input });
  await mutate<Task[]>(KEYS.tasks, (current) => [...(current ?? []), saved], { revalidate: false });
  return saved;
}

export async function deleteTask(id: number) {
  await mutate<Task[]>(
    KEYS.tasks,
    async (current) => {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      return (current ?? []).filter((t) => t.id !== id);
    },
    { optimisticData: (current) => (current ?? []).filter((t) => t.id !== id), rollbackOnError: true, revalidate: false },
  );
}

export async function reorderColumn(status: Status, orderedIds: number[]) {
  await mutate<Task[]>(
    KEYS.tasks,
    async (current) => {
      await api("/api/tasks/reorder", { method: "POST", body: { status, orderedIds } });
      return current;
    },
    {
      optimisticData: (current) =>
        (current ?? []).map((t) => {
          const i = orderedIds.indexOf(t.id);
          return i === -1 ? t : applyPatch({ ...t, position: i }, { status });
        }),
      rollbackOnError: true,
      revalidate: true,
    },
  );
}

// ---------- spaces ----------
export async function createSpace(input: Pick<Space, "name" | "color" | "view">) {
  const saved = await api<Space>("/api/spaces", { method: "POST", body: input });
  await mutate<Space[]>(KEYS.spaces, (current) => [...(current ?? []), saved], { revalidate: false });
  return saved;
}

export async function updateSpace(id: number, patch: Partial<Pick<Space, "name" | "color" | "view">>) {
  await mutate<Space[]>(
    KEYS.spaces,
    async (current) => {
      const saved = await api<Space>(`/api/spaces/${id}`, { method: "PATCH", body: patch });
      return (current ?? []).map((s) => (s.id === id ? saved : s));
    },
    { optimisticData: (current) => (current ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)), rollbackOnError: true, revalidate: false },
  );
}

export async function deleteSpace(id: number) {
  await api(`/api/spaces/${id}`, { method: "DELETE" });
  await Promise.all([mutate(KEYS.spaces), mutate(KEYS.tasks)]);
}

export async function saveDashboardSpaces(ids: number[]) {
  await mutate(
    KEYS.settings,
    async () => {
      await api("/api/settings", { method: "PUT", body: { dashboardSpaces: ids } });
      return { dashboardSpaces: ids };
    },
    { optimisticData: { dashboardSpaces: ids }, revalidate: false },
  );
}
