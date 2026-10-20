import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import {
  cleanText,
  isUuid,
  optionalNumber,
} from "@/lib/inventory-api";
import {
  MAX_INVENTORY_CATEGORY_LEN,
  MAX_INVENTORY_NAME_LEN,
  clampLowStockPercent,
  isInventoryUnit,
  normalizeIngredientName,
} from "@/lib/inventory";

export async function PATCH(
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const orgId = b?.org_id;
    if (!isUuid(orgId) || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from("inventory_items")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (lookupError || !existing) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let baseUnitChange: { from: string; to: string } | null = null;

    if ("base_unit" in b) {
      if (!isInventoryUnit(b.base_unit)) {
        return NextResponse.json({ error: "Base unit must be g, ml, or each" }, { status: 400 });
      }
      if (b.base_unit !== existing.base_unit) {
        if (b.confirm_base_unit_change !== true) {
          return NextResponse.json(
            {
              error:
                "Changing the base unit reinterprets existing stock, par, and recipe quantities. Confirm to continue.",
              requiresConfirmation: true,
            },
            { status: 409 },
          );
        }
        update.base_unit = b.base_unit;
        baseUnitChange = { from: existing.base_unit, to: b.base_unit };
      }
    }

    if (typeof b.name === "string") {
      const name = cleanText(b.name, MAX_INVENTORY_NAME_LEN);
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      update.name = name;
      update.normalized_name = normalizeIngredientName(name);
    }

    if ("category" in b) update.category = cleanText(b.category, MAX_INVENTORY_CATEGORY_LEN);
    if ("storage_location" in b) update.storage_location = cleanText(b.storage_location, 60);

    if ("par_level" in b) {
      const par = optionalNumber(b.par_level);
      if (par != null && par < 0) {
        return NextResponse.json({ error: "Par level must be zero or more" }, { status: 400 });
      }
      update.par_level = par;
    }

    if ("unit_cost" in b) {
      const cost = optionalNumber(b.unit_cost);
      if (cost != null && cost < 0) {
        return NextResponse.json({ error: "Unit cost must be zero or more" }, { status: 400 });
      }
      update.unit_cost = cost;
    }

    if ("low_stock_percent" in b) {
      update.low_stock_percent = clampLowStockPercent(b.low_stock_percent);
    }

    if ("track_stock" in b) update.track_stock = b.track_stock !== false;

    const { data, error } = await admin
      .from("inventory_items")
      .update(update)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Another ingredient already uses that name." },
          { status: 409 },
        );
      }
      console.error("[INVENTORY] update item failed:", error);
      return NextResponse.json(
        { error: "Could not update the ingredient. Please try again." },
        { status: 500 },
      );
    }

    if (baseUnitChange) {
      const { error: unitLogError } = await admin.from("inventory_transactions").insert({
        org_id: orgId,
        inventory_item_id: id,
        delta: 0,
        balance_after: Number(existing.quantity_on_hand),
        reason: "adjustment",
        note: `Base unit changed from ${baseUnitChange.from} to ${baseUnitChange.to}; quantities were reinterpreted, not converted.`,
        created_by: auth.user.id,
      });
      if (unitLogError) console.error("[INVENTORY] unit change ledger failed:", unitLogError);
    }

    if (update.track_stock === false || update.par_level === null) {
      await admin
        .from("inventory_notifications")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("org_id", orgId)
        .eq("inventory_item_id", id)
        .is("cleared_at", null)
        .in("status", ["unread", "read"]);
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("[INVENTORY] update item unhandled:", err);
    return NextResponse.json(
      { error: "Could not update the ingredient. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const orgId = b?.org_id;
    if (!isUuid(orgId) || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const admin = createAdminClient();
    const { error } = await admin
      .from("inventory_items")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      console.error("[INVENTORY] delete item failed:", error);
      return NextResponse.json(
        { error: "Could not delete the ingredient. Please try again." },
        { status: 500 },
      );
    }

    // Deleting the item cascades to recipe links, ledger rows, aliases, and
    // notifications. The UI warns about this before calling the endpoint.
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[INVENTORY] delete item unhandled:", err);
    return NextResponse.json(
      { error: "Could not delete the ingredient. Please try again." },
      { status: 500 },
    );
  }
}
