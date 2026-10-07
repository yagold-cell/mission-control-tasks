import { body, handle } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ({ dashboardSpaces: await getSetting<number[] | null>("dashboard_spaces", null) }));
}

export async function PUT(request: Request) {
  return handle(async () => {
    const b = await body(request);
    if (Array.isArray(b.dashboardSpaces)) {
      await setSetting("dashboard_spaces", b.dashboardSpaces.filter((x) => Number.isInteger(x)));
    }
    return { ok: true };
  });
}
