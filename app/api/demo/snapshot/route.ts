import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEMO_EMAIL = "demo@tablecraft.app";

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

    const sessionId = `snapshot_${orgId}_${Date.now()}`;

    // Snapshot menu_items
    const { data: menuItems } = await admin.from("menu_items").select("*").eq("org_id", orgId);
    await admin.from("demo_snapshots").insert({
      org_id: orgId,
      session_id: sessionId,
      snapshot_type: "menu_items",
      snapshot_data: menuItems ?? [],
    });

    // Snapshot tables
    const { data: tables } = await admin.from("tables").select("*").eq("org_id", orgId);
    await admin.from("demo_snapshots").insert({
      org_id: orgId,
      session_id: sessionId,
      snapshot_type: "tables",
      snapshot_data: tables ?? [],
    });

    // Snapshot bookings
    const { data: bookings } = await admin.from("bookings").select("*").eq("org_id", orgId);
    await admin.from("demo_snapshots").insert({
      org_id: orgId,
      session_id: sessionId,
      snapshot_type: "bookings",
      snapshot_data: bookings ?? [],
    });

    // Snapshot orders
    const { data: orders } = await admin.from("orders").select("*").eq("org_id", orgId);
    await admin.from("demo_snapshots").insert({
      org_id: orgId,
      session_id: sessionId,
      snapshot_type: "orders",
      snapshot_data: orders ?? [],
    });

    // Snapshot booking_tables
    const { data: bt } = await admin.from("booking_tables").select("*").eq("org_id", orgId);
    await admin.from("demo_snapshots").insert({
      org_id: orgId,
      session_id: sessionId,
      snapshot_type: "booking_tables",
      snapshot_data: bt ?? [],
    });

    // Snapshot design_settings (stored on organizations table)
    const { data: orgData } = await admin
      .from("organizations")
      .select("design_settings")
      .eq("id", orgId)
      .maybeSingle();
    await admin.from("demo_snapshots").insert({
      org_id: orgId,
      session_id: sessionId,
      snapshot_type: "design_settings",
      snapshot_data: orgData?.design_settings ?? null,
    });

    return NextResponse.json({ snapshotId: sessionId });
  } catch (err) {
    console.error("demo/snapshot: unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
