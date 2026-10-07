import { bad, body, handle } from "@/lib/api";
import { createSpace, isView, listSpaces } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => listSpaces());
}

export async function POST(request: Request) {
  return handle(async () => {
    const b = await body(request);
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad("חסר שם למרחב");
    const color = typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#6366f1";
    const view = isView(b.view) ? b.view : "kanban";
    return createSpace({ name, color, view });
  });
}
