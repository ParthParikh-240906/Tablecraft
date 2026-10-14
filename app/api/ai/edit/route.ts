import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { callGptSolHigh } from "@/lib/ai-models";
import { requireStaffForOrgId } from "@/lib/api-auth";

export type AnchorEdit = { find: string; replace: string; summary?: string };
export type AnchorEditStatus = AnchorEdit & {
  status: "matched-once" | "missing" | "ambiguous";
};

const MAX_EDITS = 10;

const EDIT_SYSTEM = `You are Tablecraft's editing model (GPT 6.1 Sol, medium effort).
You receive a restaurant's complete built website HTML plus its image gallery URLs.
Make ONLY the requested changes via anchored string replacements.
Hard rules:
- Return ONLY valid JSON: {"edits": [{"find": "<exact snippet>", "replace": "<replacement>", "summary": "<≤15 plain words>"}]} (max ${MAX_EDITS} edits).
- "find" must be copied EXACTLY from the provided HTML (whitespace included) and occur exactly once in it. Prefer short unique anchors (a line or two, e.g. the element plus its distinctive text) over large blocks.
- "replace" carries out the request at that anchor. For text removal, replace with "" or the cleaned-up line. Keep all surrounding markup, classes, and styling identical.
- For image use, ONLY use gallery URLs from the provided list — never invent URLs. To feature a gallery image in the hero, swap the hero <img> src (or HERO_IMAGE_URL const) to the gallery URL.
- NEVER touch <script> contents, endpoint URLs (/api/bookings, /api/cart/checkout, /api/chat/bookings), ORG_SLUG, the MENU_ITEMS data array, or /* CONSOLE HOOK */ markers unless the request explicitly demands it.
- If a request cannot be done with anchored replacements, return {"edits": []}.`;

/** Classify each edit's anchor against the stored HTML (preserves summary). */
export function checkAnchors(html: string, edits: AnchorEdit[]): AnchorEditStatus[] {
  return edits.slice(0, MAX_EDITS).map((edit) => {
    if (!edit || typeof edit.find !== "string" || edit.find.length === 0) {
      return { find: "", replace: "", status: "missing" as const };
    }
    const occurrences = html.split(edit.find).length - 1;
    const status = (occurrences === 1 ? "matched-once" : occurrences === 0 ? "missing" : "ambiguous") as AnchorEditStatus["status"];
    const out: AnchorEditStatus = {
      find: edit.find,
      replace: typeof edit.replace === "string" ? edit.replace : "",
      status,
    };
    if (typeof edit.summary === "string" && edit.summary.trim()) {
      out.summary = edit.summary.trim().slice(0, 120);
    }
    return out;
  });
}

/** sha256 of a page, hex — binds a preview to its apply (exact bytes). */
export function hashPage(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

/**
 * POST /api/ai/edit
 * Body: { orgId, prompt, improvise?, preview?: boolean, edits?: AnchorEdit[] }
 * Preview (default): model proposes anchored edits against the stored built
 * HTML; each anchor is classified (matched-once/missing/ambiguous).
 * Apply: pass preview:false + edits — anchors are re-checked against the
 * CURRENT stored HTML and applied atomically (all-or-nothing per edit).
 * Apply does not consume extra quota (preview already counted the edit).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const improvise = typeof body.improvise === "string" ? body.improvise : "";
  if (!orgId || !prompt.trim()) {
    return NextResponse.json({ error: "orgId and prompt are required" }, { status: 400 });
  }
  const auth = await requireStaffForOrgId(orgId);
  if ("response" in auth) return auth.response;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("name, slug, design_settings")
    .eq("id", orgId)
    .maybeSingle();
  if (!orgRow) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const settings = ((orgRow as { design_settings?: unknown }).design_settings ?? {}) as Record<string, unknown>;
  const builtHtml = typeof settings.built_html === "string" ? settings.built_html : "";
  if (!builtHtml) {
    return NextResponse.json({ error: "No built site to edit yet — run the AI build first" }, { status: 400 });
  }
  const gallery = Array.isArray(settings.ai_gallery)
    ? (settings.ai_gallery as unknown[]).filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 20)
    : [];

  // Explicit apply path: re-validate anchors against current HTML, verify the
  // preview hash (exact bytes the user previewed), then write atomically.
  if (body.preview === false) {
    if (!Array.isArray(body.edits) || body.edits.length === 0) {
      return NextResponse.json({ error: "edits must be a non-empty array" }, { status: 400 });
    }
    const checked = checkAnchors(builtHtml, body.edits as AnchorEdit[]);
    const bad = checked.filter((e) => e.status !== "matched-once");
    if (bad.length > 0) {
      return NextResponse.json(
        { error: "Some anchors no longer match the current site — re-run Preview edit", details: bad.map((e) => e.status) },
        { status: 409 },
      );
    }
    let next = builtHtml;
    for (const edit of checked) {
      next = next.replace(edit.find, edit.replace);
    }
    if (typeof body.previewHash === "string" && body.previewHash.length > 0 && hashPage(next) !== body.previewHash) {
      return NextResponse.json(
        { error: "Site changed since preview — re-run Preview edit to see the current result" },
        { status: 409 },
      );
    }
    await admin
      .from("organizations")
      .update({ design_settings: { ...settings, built_html: next } })
      .eq("id", orgId);
    console.log(`[AI EDIT] applied ${checked.length} anchor edit(s) for org ${orgId}`);
    return NextResponse.json({ applied: true, count: checked.length });
  }

  // Per-OWNER monthly edit quota (free 3 / pro 30 / max 100) aggregated
  // across all restaurants. 75% triggers a Resend warning email.
  {
    const { getOwnerForOrg, getOwnerPlanContext, checkOwnerQuota, ownerQuotaExceededResponse } = await import("@/lib/owner-quotas");
    const { ownerId, ownerEmail } = await getOwnerForOrg(orgId);
    const ownerKey = ownerId ?? `org-fallback:${orgId}`;
    const plan = ownerId ? (await getOwnerPlanContext(ownerId)).plan : "free" as const;
    const emailFinal = ownerEmail ?? (ownerId ? (await getOwnerPlanContext(ownerId)).email : null);
    const q = await checkOwnerQuota({ ownerId: ownerKey, plan, category: "edit", ownerEmail: emailFinal });
    if (!q.allowed) return ownerQuotaExceededResponse(q.used, q.limit, "edit");
  }

  const orgName = (orgRow as { name?: unknown }).name;
  const modelInput = [
    `Restaurant: ${typeof orgName === "string" ? orgName : orgId}`,
    gallery.length > 0
      ? `Gallery image URLs (use ONLY these for any image request):\n${gallery.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : `Gallery images: none yet — if the request needs a brand-new image rather than an existing URL, return {"edits": []}.`,
    `Edit request: ${prompt.slice(0, 2000)}`,
    improvise ? `Improvisation hint (apply creatively): ${improvise.slice(0, 2000)}` : ``,
    `Current site HTML:`,
    builtHtml.slice(0, 100000),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await callGptSolHigh(modelInput, { system: EDIT_SYSTEM, maxOutputTokens: 10000, effort: "medium" });
    const jsonMatch = text.match(/\{[\s\S]*\}/)?.[0];
    let edits: AnchorEdit[] = [];
    try {
      const parsed: unknown = JSON.parse(jsonMatch ?? "{}");
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as { edits?: unknown }).edits)) {
        edits = ((parsed as { edits: unknown }).edits as unknown[]).filter(
          (e): e is AnchorEdit =>
            !!e && typeof e === "object" && typeof (e as { find?: unknown }).find === "string",
        ).map((e) => ({
          find: (e as { find: string }).find,
          replace: typeof (e as { replace?: unknown }).replace === "string" ? (e as { replace: string }).replace : "",
          ...(typeof (e as { summary?: unknown }).summary === "string" ? { summary: (e as { summary: string }).summary } : {}),
        }));
      }
    } catch {
      edits = [];
    }
    const checked = checkAnchors(builtHtml, edits);
    // Exact post-apply bytes, so the console preview toggle shows precisely
    // what Apply would write. Computed locally — zero model cost.
    let patchedHtml = builtHtml;
    for (const edit of checked) {
      if (edit.status === "matched-once") patchedHtml = patchedHtml.replace(edit.find, edit.replace);
    }
    return NextResponse.json({
      model: "gpt-6.1-sol",
      effort: "medium",
      preview: true,
      edits: checked,
      patchedHtml,
      previewHash: hashPage(patchedHtml),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Edit failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("OPENAI_API") ? 500 : 502 });
  }
}
