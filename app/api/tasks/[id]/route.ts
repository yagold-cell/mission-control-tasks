import { bad, body, handle } from "@/lib/api";
import { deleteTasks, sanitizeChanges, updateTasks } from "@/lib/repo";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = Number((await ctx.params).id);
    const changes = sanitizeChanges(await body(request));
    const [task] = await updateTasks([id], changes);
    return task ?? bad("המשימה לא נמצאה", 404);
  });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await deleteTasks([Number((await ctx.params).id)]);
    return { ok: true };
  });
}
