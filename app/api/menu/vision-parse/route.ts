import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import {
  getClientIp,
  rateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import {
  estimateMenuIngredients,
  normalizeEstimateForPreview,
  persistMenuIngredients,
} from "@/lib/menu-ingredients";
import type { IngredientEstimate } from "@/types/inventory";

export const maxDuration = 60;

const COMPRESSION_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 1920;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 500;
const MAX_NAME_LEN = 200;
const MAX_DESC_LEN = 500;
const MAX_CATEGORY_LEN = 100;

/**
 * POST /api/menu/vision-parse
 * Upload a menu image → Haiku 5.5 vision extracts items → save to DB.
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  try {
    const file = formData.get("file") as File | null;
    const orgId = formData.get("orgId") as string | null;
    const mode = formData.get("mode") as "append" | "replace";
    const previewFlag = String(
      formData.get("preview") ??
        formData.get("dry_run") ??
        formData.get("dryRun") ??
        ""
    ).toLowerCase();
    const isPreview = previewFlag === "true" || previewFlag === "1";
    const estimateFlag = String(formData.get("estimateIngredients") ?? "true").toLowerCase();
    const shouldEstimateIngredients = estimateFlag !== "false" && estimateFlag !== "0";
    const itemsParam = formData.get("items") as string | null;

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing file or orgId" },
        { status: 400 }
      );
    }

    if (typeof orgId !== "string" || !UUID_RE.test(orgId)) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    if (mode !== "append" && mode !== "replace") {
      return NextResponse.json(
        { error: "mode must be 'append' or 'replace'" },
        { status: 400 }
      );
    }

    // Confirm path: client posts reviewed items as JSON (from the
    // review-before-save step) — insert directly, skipping re-extraction.
    // Already quota-counted at preview time, so no additional quota hit.
    if (typeof itemsParam === "string" && itemsParam.trim().length > 0) {
      let submitted: unknown;
      try {
        submitted = JSON.parse(itemsParam);
      } catch {
        return NextResponse.json({ error: "Invalid items JSON" }, { status: 400 });
      }
      if (!Array.isArray(submitted) || submitted.length === 0) {
        return NextResponse.json(
          { error: "No menu items to save" },
          { status: 400 }
        );
      }
      if (submitted.length > MAX_ITEMS) {
        return NextResponse.json(
          { error: "Too many menu items in the image" },
          { status: 400 }
        );
      }
      // Same validation as extracted items: name must be a non-empty
      // string, price must be a finite number.
      const validItems = (
        submitted as Array<Record<string, unknown>>
      ).filter(
        (item) =>
          item != null &&
          typeof item === "object" &&
          typeof (item as { name?: unknown }).name === "string" &&
          ((item as { name: string }).name as string).trim().length > 0 &&
          (item as { price?: unknown }).price != null &&
          Number.isFinite(Number((item as { price?: unknown }).price))
      );
      if (validItems.length === 0) {
        return NextResponse.json(
          { error: "No valid menu items found in the image" },
          { status: 400 }
        );
      }
      if (validItems.length > MAX_ITEMS) {
        return NextResponse.json(
          { error: "Too many menu items in the image" },
          { status: 400 }
        );
      }
      const normalized: InsertableItem[] = validItems.map((item) => ({
        name: (item as { name: string }).name,
        description:
          typeof (item as { description?: unknown }).description === "string"
            ? ((item as { description: string }).description as string)
            : undefined,
        price: Number((item as { price: unknown }).price),
        category:
          typeof (item as { category?: unknown }).category === "string"
            ? ((item as { category: string }).category as string)
            : undefined,
        deducts_stock: (item as { deducts_stock?: unknown }).deducts_stock !== false,
        ingredients: normalizeEstimateForPreview((item as { ingredients?: unknown }).ingredients),
      }));
      const confirmed = await insertItems(orgId, mode, normalized);
      if ("response" in confirmed) return confirmed.response;

      const warnings = await persistInsertedIngredients(orgId, confirmed.items, normalized);
      return NextResponse.json({
        success: true,
        itemCount: confirmed.count,
        ingredientWarnings: warnings.length > 0 ? warnings.slice(0, 10) : undefined,
        mode,
      });
    }

    if (!file) {
      return NextResponse.json(
        { error: "Missing file or orgId" },
        { status: 400 }
      );
    }

    // Monthly AI scan quota per org (marketed 10/15/40 per month) —
    // same rateLimit() pattern as the legacy scan route, but with a
    // 30-day window and the org's plan-tier limit.
    // Per-OWNER monthly scan quota (free 10 / pro 30 / max 70) aggregated
    // across all restaurants the owner holds — see lib/owner-quotas.ts.
    // 75% usage triggers a Resend warning email (same API key as inquiry).
    const { getOwnerForOrg, getOwnerPlanContext, checkOwnerQuota, ownerQuotaExceededResponse } = await import("@/lib/owner-quotas");
    const { ownerId: scanOwnerId, ownerEmail: scanOwnerEmail } = await getOwnerForOrg(orgId);
    const ownerKey = scanOwnerId ?? `org-fallback:${orgId}`;
    const quotaAdmin = createAdminClient();
    const ownerCtx = scanOwnerId ? await getOwnerPlanContext(scanOwnerId) : { plan: "free" as const, email: null as string | null };
    // Prefer aggregated owner plan when known; otherwise fall back to this org's plan.
    // Status-aware: a canceled subscription falls back to Free (matches displayPlan).
    let effectiveTier = ownerCtx.plan;
    try {
      const { data: orgRow } = await quotaAdmin
        .from("organizations")
        .select("subscription_plan, subscription_status")
        .eq("id", orgId)
        .maybeSingle();
      if (!scanOwnerId) {
        const { displayPlan } = await import("@/lib/pricing");
        const fallback = displayPlan(
          (orgRow as { subscription_plan?: unknown } | null)?.subscription_plan ?? null,
          (orgRow as { subscription_status?: unknown } | null)?.subscription_status ?? null,
        );
        if (fallback === "pro" || fallback === "max") effectiveTier = fallback;
      }
    } catch {
      // Fail open to the free-tier quota on lookup errors.
    }
    const scanCheck = await checkOwnerQuota({
      ownerId: ownerKey,
      plan: effectiveTier,
      category: "menu_scanner",
      ownerEmail: scanOwnerEmail ?? ownerCtx.email,
    });
    if (!scanCheck.allowed) {
      return ownerQuotaExceededResponse(scanCheck.used, scanCheck.limit, "menu scan");
    }
    const ipRl = rateLimit(
      `vision-parse:ip:${getClientIp(request)}`,
      10,
      24 * 60 * 60 * 1000
    );
    if (!ipRl.allowed) return rateLimitedResponse(ipRl.resetMs);

    // Validate image type
    const ext = (file.name ?? "").toLowerCase().split(".").pop();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
      return NextResponse.json(
        { error: "Only image files are supported (JPG, PNG, WebP)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const fileSize = bytes.byteLength;
    if (fileSize === 0 || fileSize > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
    }

    // Compress if over threshold
    let finalBuffer: Buffer = Buffer.from(bytes);
    if (fileSize > COMPRESSION_THRESHOLD) {
      console.log(`[VISION PARSE] Compressing ${fileSize / 1024 / 1024}MB image...`);
      finalBuffer = await compressImage(finalBuffer, ext || "jpg");
      console.log(`[VISION PARSE] Compressed to ${finalBuffer.length / 1024}KB`);
    }

    // Convert to base64
    const base64 = finalBuffer.toString("base64");
    const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;

    // Call Haiku 5.5 (low effort) with the menu image — same key as the
    // rest of the Tablecraft models. No fallback.
    const { callHaikuLow } = await import("@/lib/ai-models");

    const prompt = `You are a restaurant menu parser. Extract ALL menu items from this image.

Format: Each item has a name and a price (number). Items may have dotted leaders connecting name to price like "Capuccino ............. 18".

Return ONLY valid JSON with this exact structure:
{
  "items": [
    {"name": "item name", "description": "optional description", "price": 18, "category": "Hot Drinks"}
  ]
}

Rules:
- Every item MUST have a numeric "price" field
- Category should match section headers (e.g., "Hot Drinks", "Iced Drinks", "Juices", "Starters", "Mains")
- Extract ALL items visible in the menu
- Return ONLY JSON, no other text`;

    let content: string;
    try {
      content = await callHaikuLow(prompt, {
        maxTokens: 4000,
        images: [{ mediaType: mimeType, data: base64 }],
      });
    } catch (e) {
      console.error("[VISION PARSE] Haiku 5.5 failed:", e instanceof Error ? e.message.slice(0, 200) : e);
      return NextResponse.json(
        { error: "Could not parse the menu image. Please try again." },
        { status: 502 }
      );
    }
    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Could not parse the menu image. Please try again." },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let parsed: { items: Array<{ name: string; description?: string; price: number; category?: string }> };
    try {
      // Strip markdown code blocks if present
      const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0];
      parsed = JSON.parse(jsonMatch ?? content);
    } catch (e) {
      console.error("[VISION PARSE] JSON parse failed:", e);
      return NextResponse.json(
        { error: "Could not parse the menu image. Please try again." },
        { status: 500 }
      );
    }

    const menuItems = parsed.items;
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return NextResponse.json(
        { error: "No menu items found in image" },
        { status: 400 }
      );
    }

    // Filter out items without prices
    const validItems = menuItems.filter(
      (item) => item.price != null && typeof item.price === "number" && Number.isFinite(item.price) && typeof item.name === "string" && item.name.trim()
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "No valid menu items found in the image" },
        { status: 400 }
      );
    }
    if (validItems.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Too many menu items in the image" }, { status: 400 });
    }

    // Preview mode: run the same extraction pipeline but return the items
    // WITHOUT inserting — the client shows the review-before-save step and
    // POSTs back `items` JSON to confirm. Same length/cap sanitization.
    if (isPreview) {
      const sanitized = validItems.map((item) => ({
        name: String(item.name).slice(0, MAX_NAME_LEN),
        description:
          typeof item.description === "string"
            ? item.description.slice(0, MAX_DESC_LEN)
            : undefined,
        price: Number(item.price),
        category:
          typeof item.category === "string"
            ? item.category.slice(0, MAX_CATEGORY_LEN)
            : undefined,
      }));

      let estimates: Awaited<ReturnType<typeof estimateMenuIngredients>> | null = null;
      if (shouldEstimateIngredients) {
        let restaurantName = "this restaurant";
        try {
          const admin = createAdminClient();
          const { data: orgRow } = await admin
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .maybeSingle();
          if (orgRow?.name) restaurantName = orgRow.name;
        } catch {
          // Use the generic name; estimation can still proceed.
        }
        estimates = await estimateMenuIngredients(restaurantName, sanitized);
      }

      const previewItems = sanitized.map((item, index) => ({
        ...item,
        deducts_stock: true,
        ingredients: estimates?.byIndex.get(index) ?? [],
      }));

      return NextResponse.json({
        success: true,
        preview: true,
        items: previewItems,
        itemCount: previewItems.length,
        ingredientError: estimates?.error ?? null,
        mode,
      });
    }

    // Insert into DB (unchanged legacy path, via shared helper)
    const inserted = await insertItems(orgId, mode, validItems);
    if ("response" in inserted) return inserted.response;

    return NextResponse.json({
      success: true,
      itemCount: inserted.count,
      mode,
    });
  } catch {
    console.error("[VISION PARSE] unhandled error");
    return NextResponse.json(
      { error: "Could not parse the menu image. Please try again." },
      { status: 500 }
    );
  }
}

type InsertableItem = {
  name: string;
  description?: string;
  price: number;
  category?: string;
  deducts_stock?: boolean;
  ingredients?: IngredientEstimate[];
};

type InsertedMenuItem = { id: string; name: string };

/**
 * Shared insert path for extracted AND client-reviewed items.
 * Same caps/validation, same replace-mode delete-then-insert logic.
 */
async function insertItems(
  orgId: string,
  mode: "append" | "replace",
  items: InsertableItem[]
): Promise<
  | { count: number; items: InsertedMenuItem[] }
  | { response: ReturnType<typeof NextResponse.json> }
> {
  const supabase = createAdminClient();
  if (mode === "replace") {
    const { error: deleteError } = await supabase
      .from("menu_items")
      .delete()
      .eq("org_id", orgId);
    if (deleteError) {
      console.error("[VISION PARSE] Delete error:", deleteError);
      return {
        response: NextResponse.json(
          { error: "Could not save menu items. Please try again." },
          { status: 500 }
        ),
      };
    }
  }

  // Append mode must continue AFTER existing numbering: restarting at 1
  // would collide with current rows and scramble website order. New
  // categories open trailing slots; existing ones keep their stored order.
  const sortBase: Record<string, number> = {};
  const storedCatOrder: Record<string, number> = {};
  let maxCatOrder = -1;
  if (mode === "append") {
    const { data: existing } = await supabase
      .from("menu_items")
      .select("category, sort_order, category_sort_order")
      .eq("org_id", orgId);
    for (const r of (existing ?? []) as Array<{ category?: string | null; sort_order?: number | null; category_sort_order?: number | null }>) {
      const cat = r.category || "Other";
      if (typeof r.sort_order === "number") {
        sortBase[cat] = Math.max(sortBase[cat] ?? 0, r.sort_order);
      }
      if (typeof r.category_sort_order === "number") {
        storedCatOrder[cat] = r.category_sort_order;
        maxCatOrder = Math.max(maxCatOrder, r.category_sort_order);
      }
    }
  }

  // Calculate category_sort_order based on first appearance of each category
  const categoryOrder: Record<string, number> = {};
  let catIdx = maxCatOrder + 1;
  for (const item of items) {
    const cat = item.category || "Other";
    if (!(cat in categoryOrder)) {
      categoryOrder[cat] = storedCatOrder[cat] ?? catIdx++;
    }
  }

  const perCatCount: Record<string, number> = {};
  const rows = items.slice(0, MAX_ITEMS).map((item) => {
    const cat = item.category || "Other";
    perCatCount[cat] = (perCatCount[cat] ?? 0) + 1;
    return {
      org_id: orgId,
      name: String(item.name).slice(0, MAX_NAME_LEN),
      description:
        typeof item.description === "string"
          ? item.description.slice(0, MAX_DESC_LEN)
          : null,
      price: Number(item.price),
      category:
        typeof item.category === "string"
          ? item.category.slice(0, MAX_CATEGORY_LEN)
          : null,
      available: true,
      deducts_stock: item.deducts_stock !== false,
      sort_order: (sortBase[cat] ?? 0) + perCatCount[cat],
      category_sort_order: categoryOrder[cat] ?? 0,
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from("menu_items")
    .insert(rows)
    .select("id, name");

  if (insertError) {
    console.error("[VISION PARSE] Insert error:", insertError);
    return {
      response: NextResponse.json(
        { error: "Could not save menu items. Please try again." },
        { status: 500 }
      ),
    };
  }

  return {
    count: rows.length,
    items: (inserted ?? []) as InsertedMenuItem[],
  };
}

/**
 * Persist ingredient estimates for inserted menu items. A failure here does not
 * roll back the menu save; the API returns warnings so staff can fix recipes.
 */
async function persistInsertedIngredients(
  orgId: string,
  inserted: InsertedMenuItem[],
  source: InsertableItem[],
): Promise<string[]> {
  if (inserted.length === 0) return [];
  const admin = createAdminClient();
  const warnings: string[] = [];

  for (let i = 0; i < inserted.length; i++) {
    const estimates = source[i]?.ingredients ?? [];
    if (estimates.length === 0) continue;
    const itemWarnings = await persistMenuIngredients(
      admin,
      orgId,
      inserted[i].id,
      estimates,
    );
    warnings.push(...itemWarnings.map((w) => `${inserted[i].name}: ${w}`));
  }

  return warnings;
}

async function compressImage(data: Buffer, ext: string): Promise<Buffer> {
  const tmpDir = path.join(process.cwd(), ".tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  const inputPath = path.join(tmpDir, `input-${Date.now()}.${ext}`);
  const outputPath = path.join(tmpDir, `compressed-${Date.now()}.jpg`);

  await fs.writeFile(inputPath, data);

  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [
      path.join(process.cwd(), "scripts/compress-image.py"),
      inputPath,
      outputPath,
      String(MAX_WIDTH),
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on("close", (code) => {
      fs.unlink(inputPath).catch(() => {});
      fs.unlink(outputPath).catch(() => {});

      if (code !== 0) {
        reject(new Error(`Compression failed: ${stderr}`));
        return;
      }
      resolve(Buffer.from(require("fs").readFileSync(outputPath as string)));
    });
    proc.on("error", reject);
  });
}
