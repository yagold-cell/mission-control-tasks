import { NextResponse } from "next/server";
import { body } from "@/lib/api";
import { resolvePending } from "@/lib/agent";

export async function POST(request: Request) {
  const b = await body(request);
  if (typeof b.id !== "string") return NextResponse.json({ error: "חסר מזהה פעולה" }, { status: 400 });
  try {
    return NextResponse.json(await resolvePending(b.id, b.approve === true));
  } catch (e) {
    console.error("confirm error", e);
    return NextResponse.json({ error: "הפעולה נכשלה" }, { status: 500 });
  }
}
