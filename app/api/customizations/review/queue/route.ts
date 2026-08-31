import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Review queue for the Hermes agent.
 *
 * Returns customization requests that Kiro-frontend has finished generating
 * (status 'pending_review') — these are NOT yet visible to the owner.
 * Hermes reviews each preview against the original request, then calls
 * /api/customizations/review/decision to approve (owner sees it) or reject
 * (send back to Kiro for revision).
 *
 * Protected by a review key so arbitrary logged-in users can't see it.
 */
export async function GET(request: Request) {
  const reviewKey = process.env.REVIEW_GATE_KEY;
  const auth = request.headers.get("authorization");
  if (!reviewKey || auth !== `Bearer ${reviewKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: requests, error } = await supabase
    .from("customization_requests")
    .select("*")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ requests });
}
