export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "new" | "in_progress" | "on_hold" | "done";
export type ViewType = "kanban" | "todo" | "calendar";

export interface Space {
  id: number;
  name: string;
  color: string;
  view: ViewType;
  position: number;
  created_at: string;
}

export interface Task {
  id: number;
  space_id: number;
  title: string;
  notes: string;
  priority: Priority;
  status: Status;
  due_date: string | null; // YYYY-MM-DD
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AgentScope = { type: "all" } | { type: "space"; spaceId: number };

export interface PendingAction {
  id: string;
  kind: "update" | "delete";
  count: number;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: PendingAction;
  pendingState?: "open" | "approved" | "rejected";
  error?: boolean;
  changes?: string[];
}
