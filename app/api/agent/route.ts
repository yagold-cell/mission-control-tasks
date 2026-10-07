import { NextResponse } from "next/server";
import { body } from "@/lib/api";
import { runAgent } from "@/lib/agent";
import type { AgentScope } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const b = await body(request);
  const raw = b.scope as { type?: string; spaceId?: unknown } | undefined;
  const scope: AgentScope =
    raw?.type === "space" && Number.isInteger(raw.spaceId) ? { type: "space", spaceId: raw.spaceId as number } : { type: "all" };
  const history = (Array.isArray(b.messages) ? b.messages : [])
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "חסרה הודעה" }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "מפתח OPENAI_API_KEY לא מוגדר בשרת" }, { status: 500 });
  }
  try {
    return NextResponse.json(await runAgent(history, scope));
  } catch (e) {
    console.error("agent error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "הסוכן לא הצליח לענות כרגע. נסה שוב בעוד רגע.", detail: msg.slice(0, 300) }, { status: 502 });
  }
}
