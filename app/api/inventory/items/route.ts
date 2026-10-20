import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { isUuid, parseInventoryItemInput } from "@/lib/inventory-api";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const b = body as Record<string, unknown>;
    const orgId = b?.org_id;
    if (!isUuid(orgId)) {
      return NextResponse.json({ error: "Invalid org_id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const parsed = parseInventoryItemInput(body, { requireName: true });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("inventory_items")
      .insert({
        org_id: orgId,
        ...parsed.value,
        ai_estimated: false,
        source: "manual",
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "An ingredient with that name already exists." },
          { status: 409 },
        );
      }
      console.error("[INVENTORY] create item failed:", error);
      return NextResponse.json(
        { error: "Could not create the ingredient. Please try again." },
        { status: 500 },
      );
    }

    // Opening stock gets an initial ledger row, otherwise the balance would
    // appear from nowhere and the history would start with a gap.
    if (data && Number(data.quantity_on_hand) > 0) {
      const { error: txError } = await admin.from("inventory_transactions").insert({
        org_id: orgId,
        inventory_item_id: data.id,
        delta: Number(data.quantity_on_hand),
        balance_after: Number(data.quantity_on_hand),
        reason: "initial",
        note: "Opening stock",
        created_by: auth.user.id,
      });
      if (txError) console.error("[INVENTORY] opening stock ledger failed:", txError);
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("[INVENTORY] create item unhandled:", err);
    return NextResponse.json(
      { error: "Could not create the ingredient. Please try again." },
      { status: 500 },
    );
  }
}
