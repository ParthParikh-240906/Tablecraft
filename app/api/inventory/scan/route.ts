import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { consumeSharedScanQuota } from "@/lib/scan-quota";
import {
  INVENTORY_SCAN_PROMPT,
  MAX_SCAN_LINES,
  matchInventoryLines,
  normalizeInventoryScan,
} from "@/lib/inventory-scan";
import {
  DEFAULT_LOW_STOCK_PERCENT,
  MAX_INVENTORY_CATEGORY_LEN,
  MAX_INVENTORY_NAME_LEN,
  baseUnitForDimension,
  convertToBaseUnit,
  normalizeIngredientName,
  toFiniteNumber,
  unitDimension,
} from "@/lib/inventory";
import { cleanText, isUuid } from "@/lib/inventory-api";
import type { InventoryScanLine, InventoryUnit } from "@/types/inventory";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_NAME_LEN = MAX_INVENTORY_NAME_LEN;

type ConfirmLine = InventoryScanLine & {
  matched_item_id?: string | null;
  create_new?: boolean;
  par_level?: number | null;
};

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  try {
    const orgId = formData.get("orgId");
    if (!isUuid(orgId)) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }

    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    const linesParam = formData.get("lines");
    if (typeof linesParam === "string" && linesParam.trim()) {
      return confirmScan(orgId, auth.user.id, linesParam);
    }

    return previewScan(request, orgId, formData);
  } catch (err) {
    console.error("[INVENTORY SCAN] unhandled:", err);
    return NextResponse.json(
      { error: "Could not process the inventory scan. Please try again." },
      { status: 500 },
    );
  }
}

async function previewScan(request: NextRequest, orgId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const ext = (file.name ?? "").toLowerCase().split(".").pop();
  if (!["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
    return NextResponse.json(
      { error: "Only image files are supported (JPG, PNG, WebP)" },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }

  const ipRl = rateLimit(`inventory-scan:ip:${getClientIp(request)}`, 10, 24 * 60 * 60 * 1000);
  if (!ipRl.allowed) return rateLimitedResponse(ipRl.resetMs);

  const quota = await consumeSharedScanQuota(orgId);
  if (!quota.allowed) return quota.response;

  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
  const { callHaikuLow } = await import("@/lib/ai-models");

  let text: string;
  try {
    text = await callHaikuLow(INVENTORY_SCAN_PROMPT, {
      maxTokens: 4000,
      effort: "low",
      disableThinking: true,
      images: [{ mediaType: mimeType, data: base64 }],
    });
  } catch (e) {
    console.error("[INVENTORY SCAN] model failed:", e instanceof Error ? e.message.slice(0, 200) : e);
    return NextResponse.json(
      { error: "Could not read the bill/list. Please try a clearer photo." },
      { status: 502 },
    );
  }

  const preview = normalizeInventoryScan(text);
  if (!preview) {
    return NextResponse.json(
      { error: "No purchased items found. Try a clearer photo or a written list." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const [{ data: items }, { data: aliases }] = await Promise.all([
    admin
      .from("inventory_items")
      .select("id, name, normalized_name, base_unit, quantity_on_hand, par_level")
      .eq("org_id", orgId)
      .eq("archived", false),
    admin
      .from("inventory_aliases")
      .select("alias, normalized_alias, inventory_item_id")
      .eq("org_id", orgId),
  ]);

  const matched = matchInventoryLines(
    preview.lines,
    (items ?? []) as Array<{
      id: string;
      name: string;
      normalized_name: string;
      base_unit: InventoryUnit;
      quantity_on_hand: number;
      par_level: number | null;
    }>,
    (aliases ?? []) as Array<{
      alias: string;
      normalized_alias: string;
      inventory_item_id: string;
    }>,
  );

  return NextResponse.json({
    success: true,
    preview: true,
    documentType: preview.document_type,
    currency: preview.currency,
    lines: matched,
    lineCount: matched.length,
  });
}

async function confirmScan(orgId: string, userId: string, linesJson: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(linesJson);
  } catch {
    return NextResponse.json({ error: "Invalid lines JSON" }, { status: 400 });
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return NextResponse.json({ error: "No lines to save" }, { status: 400 });
  }
  if (parsed.length > MAX_SCAN_LINES) {
    return NextResponse.json({ error: "Too many lines" }, { status: 400 });
  }

  const admin = createAdminClient();
  const receipts: Array<{ inventory_item_id: string; quantity: number; unit_cost?: number | null; note?: string }> = [];
  const createdIds: string[] = [];
  let updatedExisting = 0;

  try {
    for (const raw of parsed as ConfirmLine[]) {
      const name = cleanText(raw?.name, MAX_NAME_LEN);
      const qty = toFiniteNumber(raw?.quantity);
      const unit = typeof raw?.unit === "string" ? raw.unit : "each";
      const scannedUnitPrice = toFiniteNumber(raw?.unit_price);
      if (!name || qty == null || qty <= 0) {
        return NextResponse.json({ error: "Each line needs a name and a positive quantity" }, { status: 400 });
      }

      let item: {
        id: string;
        name: string;
        normalized_name: string;
        base_unit: InventoryUnit;
      } | null = null;

      if (isUuid(raw?.matched_item_id)) {
        const { data } = await admin
          .from("inventory_items")
          .select("id, name, normalized_name, base_unit, archived")
          .eq("id", raw.matched_item_id)
          .eq("org_id", orgId)
          .maybeSingle();
        if (!data || data.archived) {
          return NextResponse.json({ error: `Ingredient not found: ${name}` }, { status: 400 });
        }
        item = data;
        updatedExisting++;
      } else {
        const dimension = unitDimension(unit);
        if (!dimension) {
          return NextResponse.json({ error: `Unsupported unit for ${name}: ${unit}` }, { status: 400 });
        }
        const baseUnit = baseUnitForDimension(dimension);
        const normalized = normalizeIngredientName(name);
        const newBaseQty = convertToBaseUnit(qty, unit, baseUnit);
        if (!newBaseQty.ok) {
          return NextResponse.json({ error: `${name}: ${newBaseQty.error}` }, { status: 400 });
        }
        const scannedPar = toFiniteNumber(raw.par_level);
        const newBasePar =
          scannedPar != null ? convertToBaseUnit(scannedPar, unit, baseUnit) : null;
        const { data, error } = await admin
          .from("inventory_items")
          .insert({
            org_id: orgId,
            name: name.slice(0, MAX_NAME_LEN),
            normalized_name: normalized,
            category: cleanText(raw.category, MAX_INVENTORY_CATEGORY_LEN),
            base_unit: baseUnit,
            quantity_on_hand: 0,
            par_level: newBasePar?.ok ? newBasePar.value : null,
            low_stock_percent: DEFAULT_LOW_STOCK_PERCENT,
            unit_cost:
              scannedUnitPrice != null && newBaseQty.value > 0
                ? (scannedUnitPrice * qty) / newBaseQty.value
                : null,
            storage_location: null,
            track_stock: true,
            ai_estimated: true,
            source: "inventory_scan",
          })
          .select("id, name, normalized_name, base_unit")
          .single();

        if (error) {
          if (error.code === "23505") {
            const { data: existing } = await admin
              .from("inventory_items")
              .select("id, name, normalized_name, base_unit, archived")
              .eq("org_id", orgId)
              .eq("normalized_name", normalized)
              .eq("archived", false)
              .maybeSingle();
            if (!existing || existing.archived) {
              return NextResponse.json({ error: `Could not match ${name}` }, { status: 409 });
            }
            item = existing;
          } else {
            console.error("[INVENTORY SCAN] create item failed:", error);
            return NextResponse.json({ error: `Could not create ${name}` }, { status: 500 });
          }
        } else if (data) {
          item = data;
          createdIds.push(data.id);
        }
      }

      if (!item) {
        return NextResponse.json({ error: `Could not match ${name}` }, { status: 400 });
      }

      const converted = convertToBaseUnit(qty, unit, item.base_unit);
      if (!converted.ok) {
        return NextResponse.json({ error: `${name}: ${converted.error}` }, { status: 400 });
      }

      receipts.push({
        inventory_item_id: item.id,
        quantity: converted.value,
        unit_cost:
          scannedUnitPrice != null && converted.value > 0
            ? (scannedUnitPrice * qty) / converted.value
            : null,
        note: name,
      });

      if (normalizeIngredientName(name) !== item.normalized_name) {
        await admin.from("inventory_aliases").upsert(
          {
            org_id: orgId,
            inventory_item_id: item.id,
            alias: name.slice(0, MAX_NAME_LEN),
            normalized_alias: normalizeIngredientName(name),
          },
          { onConflict: "org_id,normalized_alias", ignoreDuplicates: true },
        );
      }
    }

    const { data, error } = await admin.rpc("apply_inventory_receipts", {
      p_org_id: orgId,
      p_lines: receipts,
      p_reason: "scan",
      p_created_by: userId,
      p_reference_id: null,
    });

    if (error) {
      console.error("[INVENTORY SCAN] receipt RPC failed:", error);
      if (createdIds.length > 0) {
        await admin.from("inventory_items").delete().in("id", createdIds).eq("org_id", orgId);
      }
      return NextResponse.json(
        { error: "Could not add the scanned items to stock. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      itemCount: receipts.length,
      created: createdIds.length,
      updated: updatedExisting,
      affected: (data as { affected?: number } | null)?.affected ?? 0,
    });
  } catch (err) {
    console.error("[INVENTORY SCAN] confirm unhandled:", err);
    if (createdIds.length > 0) {
      await admin.from("inventory_items").delete().in("id", createdIds).eq("org_id", orgId);
    }
    return NextResponse.json(
      { error: "Could not add the scanned items to stock. Please try again." },
      { status: 500 },
    );
  }
}
