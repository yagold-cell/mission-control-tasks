import { bad, body, handle } from "@/lib/api";
import { deleteSpace, isView, updateSpace } from "@/lib/repo";
import type { ViewType } from "@/lib/types";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = Number((await ctx.params).id);
    const b = await body(request);
    const space = await updateSpace(id, {
      name: typeof b.name === "string" ? b.name.trim() : undefined,
      color: typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : undefined,
      view: isView(b.view) ? (b.view as ViewType) : undefined,
    });
    return space ?? bad("המרחב לא נמצא", 404);
  });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await deleteSpace(Number((await ctx.params).id));
    return { ok: true };
  });
}
