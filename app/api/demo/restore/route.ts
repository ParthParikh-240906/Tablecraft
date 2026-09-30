import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  try {
    const { orgId } = (await request.json()) as { orgId?: string };

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify this is a demo org
    const { data: org } = await admin
      .from("organizations")
      .select("is_demo")
      .eq("id", orgId)
      .maybeSingle();

    if (!org?.is_demo) {
      return NextResponse.json({ error: "Not a demo organization" }, { status: 403 });
    }

    // Find the most recent snapshot for this org
    const { data: latestSnap } = await admin
      .from("demo_snapshots")
      .select("session_id, snapshot_type, snapshot_data")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!latestSnap || latestSnap.length === 0) {
      // No snapshot exists — nothing to restore
      return NextResponse.json({ success: true });
    }

    const snapshotId = latestSnap[0].session_id;
    const typesToRestore: Array<"menu_items" | "tables" | "bookings" | "orders" | "booking_tables"> =
      ["menu_items", "tables", "bookings", "orders", "booking_tables"];

    for (const type of typesToRestore) {
      // Delete all current data
      await admin.from(type).delete().eq("org_id", orgId);

      // Find snapshot for this type
      const { data: typeSnap } = await admin
        .from("demo_snapshots")
        .select("snapshot_data")
        .eq("org_id", orgId)
        .eq("session_id", snapshotId)
        .eq("snapshot_type", type)
        .maybeSingle();

      if (typeSnap?.snapshot_data && Array.isArray(typeSnap.snapshot_data)) {
        // Remove ids when re-inserting so new ids are generated
        await admin.from(type).insert(
          typeSnap.snapshot_data.map(({ id, ...rest }: any) => rest)
        );
      }
    }

    // Delete all snapshot records for this org
    await admin.from("demo_snapshots").delete().eq("org_id", orgId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("demo/restore: unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
