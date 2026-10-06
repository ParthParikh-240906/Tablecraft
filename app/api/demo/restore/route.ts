import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/demo/restore
 *
 * Restores all editable data for a demo org from the most recent snapshot.
 * Also clears the snapshot records.
 *
 * Body: { orgId: string }
 * Returns: { success: true }
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
      console.error("demo/restore: org lookup failed", orgError);
      return NextResponse.json({ error: "Could not restore the demo. Please try again." }, { status: 500 });
    }
    if (!org?.is_demo) {
      return NextResponse.json({ error: "Not a demo organization" }, { status: 403 });
    }

    // Find the most recent snapshot for this org
    const { data: latestSnap, error: latestError } = await admin
      .from("demo_snapshots")
      .select("session_id, snapshot_type, snapshot_data")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestError) {
      console.error("demo/restore: snapshot lookup failed", latestError);
      return NextResponse.json({ error: "Could not restore the demo. Please try again." }, { status: 500 });
    }
    if (!latestSnap || latestSnap.length === 0) {
      // No snapshot exists — nothing to restore
      return NextResponse.json({ success: true });
    }

    const snapshotId = latestSnap[0].session_id;
    const typesToRestore: Array<"menu_items" | "tables" | "bookings" | "orders" | "booking_tables"> =
      ["menu_items", "tables", "bookings", "orders", "booking_tables"];

    for (const type of typesToRestore) {
      // Delete all current data
      const { error: deleteError } = await admin.from(type).delete().eq("org_id", orgId);
      if (deleteError) {
        console.error(`demo/restore: delete ${type} failed`, deleteError);
        return NextResponse.json({ error: "Could not restore the demo. Please try again." }, { status: 500 });
      }

      // Find snapshot for this type
      const { data: typeSnap, error: typeError } = await admin
        .from("demo_snapshots")
        .select("snapshot_data")
        .eq("org_id", orgId)
        .eq("session_id", snapshotId)
        .eq("snapshot_type", type)
        .maybeSingle();

      if (typeError) {
        console.error(`demo/restore: snapshot ${type} lookup failed`, typeError);
        return NextResponse.json({ error: "Could not restore the demo. Please try again." }, { status: 500 });
      }

      if (typeSnap?.snapshot_data && Array.isArray(typeSnap.snapshot_data) && typeSnap.snapshot_data.length > 0) {
        // Remove ids when re-inserting so new ids are generated
        const { error: insertError } = await admin.from(type).insert(
          (typeSnap.snapshot_data as Array<Record<string, unknown>>).map(({ id, ...rest }: any) => rest)
        );
        if (insertError) {
          console.error(`demo/restore: insert ${type} failed`, insertError);
          return NextResponse.json({ error: "Could not restore the demo. Please try again." }, { status: 500 });
        }
      }
    }

    // Delete all snapshot records for this org
    const { error: cleanupError } = await admin.from("demo_snapshots").delete().eq("org_id", orgId);
    if (cleanupError) {
      console.error("demo/restore: snapshot cleanup failed", cleanupError);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("demo/restore: unexpected error", err);
    return NextResponse.json({ error: "Could not restore the demo. Please try again." }, { status: 500 });
  }
}
