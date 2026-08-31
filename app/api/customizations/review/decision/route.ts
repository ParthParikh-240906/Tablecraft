import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Hermes review decision for a Kiro-frontend design.
 *
 * Body: { requestId, decision: "approve" | "reject", reviewNotes? }
 *
 * - approve → status becomes 'pending' (the owner now sees the proposal)
 * - reject  → status becomes 'rejected' with review notes (feedback for
 *              optionally regenerating via Kiro)
 *
 * Protected by the same review key as the queue.
 */
export async function POST(request: Request) {
  const reviewKey = process.env.REVIEW_GATE_KEY;
  const auth = request.headers.get("authorization");
  if (!reviewKey || auth !== `Bearer ${reviewKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, decision, reviewNotes } = await request.json();
  if (!requestId || !["approve", "reject"].includes(decision)) {
    return NextResponse.json({ error: "requestId and decision required" }, { status: 400 });
  }

  const supabase = await createClient();
  const nextStatus = decision === "approve" ? "pending" : "rejected";
  const patch: Record<string, unknown> = {
    status: nextStatus,
    reviewed_at: new Date().toISOString(),
  };
  if (reviewNotes) patch.review_notes = reviewNotes;

  const { error } = await supabase
    .from("customization_requests")
    .update(patch)
    .eq("id", requestId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, status: nextStatus });
}
