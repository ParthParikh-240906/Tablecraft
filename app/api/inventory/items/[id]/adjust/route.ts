import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { isUuid, parseAdjustInput } from "@/lib/inventory-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const b = body as Record<string, unknown>;
    const orgId = b?.org_id;
    if (!isUuid(orgId) || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const parsed = parseAdjustInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("adjust_inventory_stock", {
      p_org_id: orgId,
      p_item_id: id,
      p_mode: parsed.mode,
      p_quantity: parsed.quantity,
      p_reason: parsed.reason,
      p_note: parsed.note,
      p_reference_type: null,
      p_reference_id: null,
      p_created_by: auth.user.id,
    });

    if (error) {
      console.error("[INVENTORY] adjust failed:", error);
      const message =
        /archived|not found|invalid/i.test(error.message)
          ? error.message
          : "Could not update stock. Please try again.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ result: data });
  } catch (err) {
    console.error("[INVENTORY] adjust unhandled:", err);
    return NextResponse.json(
      { error: "Could not update stock. Please try again." },
      { status: 500 },
    );
  }
}
