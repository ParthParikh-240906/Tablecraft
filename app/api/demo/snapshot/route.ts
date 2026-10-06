import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

const DEMO_EMAIL = "demo@tablecraft.app";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/demo/snapshot
 *
 * Captures the current state of all editable data for a demo org so it can
 * be restored later when the demo session times out.
 *
 * Body: { orgId: string }
 * Returns: { snapshotId: string }
 */
export async function POST(request: Request) {
  const rl = rateLimit(`demo:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { orgId } = (body ?? {}) as { orgId?: unknown };

    if (typeof orgId !== "string" || !UUID_RE.test(orgId)) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const admin = createAdminClient();

    // Verify this is a demo org
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("is_demo")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError) {
      console.error("demo/snapshot: org lookup failed", orgError);
      return NextResponse.json({ error: "Could not capture the demo snapshot. Please try again." }, { status: 500 });
    }
    if (!org?.is_demo) {
      return NextResponse.json({ error: "Not a demo organization" }, { status: 403 });
    }

    const sessionId = `snapshot_${orgId}_${Date.now()}`;

    const tables: Array<{ table: string; rows: unknown }> = [];
    for (const t of ["menu_items", "tables", "bookings", "orders", "booking_tables"] as const) {
      const { data, error: selectError } = await admin.from(t).select("*").eq("org_id", orgId);
      if (selectError) {
        console.error(`demo/snapshot: select ${t} failed`, selectError);
        return NextResponse.json({ error: "Could not capture the demo snapshot. Please try again." }, { status: 500 });
      }
      tables.push({ table: t, rows: data ?? [] });
    }
    for (const { table, rows } of tables) {
      const { error: insertError } = await admin.from("demo_snapshots").insert({
        org_id: orgId,
        session_id: sessionId,
        snapshot_type: table,
        snapshot_data: rows,
      });
      if (insertError) {
        console.error(`demo/snapshot: insert ${table} failed`, insertError);
        return NextResponse.json({ error: "Could not capture the demo snapshot. Please try again." }, { status: 500 });
      }
    }

    return NextResponse.json({ snapshotId: sessionId });
  } catch (err) {
    console.error("demo/snapshot: unexpected error", err);
    return NextResponse.json({ error: "Could not capture the demo snapshot. Please try again." }, { status: 500 });
  }
}
