import { bad, body, handle } from "@/lib/api";
import { isStatus, reorderColumn } from "@/lib/repo";

export async function POST(request: Request) {
  return handle(async () => {
    const b = await body(request);
    const ids = Array.isArray(b.orderedIds) ? b.orderedIds.filter((x): x is number => Number.isInteger(x)) : [];
    if (!isStatus(b.status)) return bad("סטטוס לא תקין");
    await reorderColumn(b.status, ids);
    return { ok: true };
  });
}
