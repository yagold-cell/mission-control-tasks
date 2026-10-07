import { bad, body, handle } from "@/lib/api";
import { createTasks, isDate, isPriority, isStatus, listTasks } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => listTasks());
}

export async function POST(request: Request) {
  return handle(async () => {
    const b = await body(request);
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title) return bad("חסרה כותרת למשימה");
    if (typeof b.space_id !== "number") return bad("חסר מרחב");
    const [task] = await createTasks([{
      space_id: b.space_id,
      title,
      notes: typeof b.notes === "string" ? b.notes : "",
      priority: isPriority(b.priority) ? b.priority : "medium",
      status: isStatus(b.status) ? b.status : "new",
      due_date: isDate(b.due_date) ? b.due_date : null,
    }]);
    return task;
  });
}
