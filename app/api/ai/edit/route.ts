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
You receive a restaurant's complete built website HTML plus its named image gallery.
Make ONLY the requested changes via anchored string replacements.
Hard rules:
- Return ONLY valid JSON: {"edits": [{"find": "<exact snippet>", "replace": "<replacement>", "summary": "<≤15 plain words>"}], "logo_url": "<gallery URL or omitted>"} (max ${MAX_EDITS} edits).
- "find" must be copied EXACTLY from the provided HTML (whitespace included) and occur exactly once in it. Prefer short unique anchors (a line or two, e.g. the element plus its distinctive text) over large blocks.
- "replace" carries out the request at that anchor. For text removal, replace with "" or the cleaned-up line. Keep all surrounding markup, classes, and styling identical.
- For image use, ONLY use gallery URLs from the provided list — never invent URLs. To feature a gallery image in the hero, swap the hero <img> src (or HERO_IMAGE_URL const) to the gallery URL. For a mobile-only hero change, swap the HERO_IMAGE_URL_MOBILE const instead and leave HERO_IMAGE_URL untouched.
- MENU RULE: menu content changes (add/remove/rename/reprice/recategorize/reorder dishes) must be done ONLY by editing entries of the MENU_ITEMS const — never bake dish names, descriptions, or prices into static HTML, and never change the declaration shape (it must stay matchable as the const assignment the console swaps for live DB rows). The menu grid container stays empty in static markup; cards are rendered from the const via JS.
- HERO RULE: when the request asks to change the mobile hero/background image (e.g. 'use "name" image as the mobile hero' or 'mobile background'), swap ONLY the HERO_IMAGE_URL_MOBILE const value to that gallery URL — keep the declaration shape (const HERO_IMAGE_URL_MOBILE = "...";) so the console can still match it, keep the 720px mobile-preference wiring intact, and never touch HERO_IMAGE_URL (desktop) unless explicitly asked. A desktop hero request swaps ONLY HERO_IMAGE_URL and leaves the mobile const untouched.
- LOGO RULE: when the request asks to add/set/use a logo (e.g. 'use "logo" image as the logo'), swap the header/brand logo <img> src to that gallery URL AND return its exact URL in the top-level "logo_url" field so the console also saves it as the restaurant logo. Omit "logo_url" for non-logo requests.
- NEVER touch <script> contents, endpoint URLs (/api/bookings, /api/cart/checkout, /api/chat/bookings), ORG_SLUG, the MENU_ITEMS data array, or /* CONSOLE HOOK */ markers unless the request explicitly demands it (a hero/logo/menu/image request explicitly demands editing ONLY its corresponding const/img src: HERO_IMAGE_URL* for hero, logo <img> for logo, MENU_ITEMS for menu).
- When additional creative direction is provided alongside the edit request, apply BOTH (the direction refines how the request is carried out, not an optional hint).
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
  const { normalizeGallery } = await import("@/lib/design");
  const gallery = normalizeGallery(settings.ai_gallery, 20);
  const galleryUrls = new Set(gallery.map((g) => g.url));

  /** Resolve a logo URL from an explicit value or a logo-intent prompt fallback. */
  const resolveLogoUrl = (explicit: unknown, promptText: string): string | null => {
    if (typeof explicit === "string" && galleryUrls.has(explicit)) return explicit;
    // Fallback: prompt asks for a logo and names/pastes a gallery image.
    if (/logo/i.test(promptText) && gallery.length > 0) {
      // Prefer the gallery item whose name appears in the prompt (e.g. "logo").
      const lower = promptText.toLowerCase();
      for (const g of gallery) {
        if (g.name && lower.includes(g.name.toLowerCase())) return g.url;
      }
      for (const g of gallery) {
        if (promptText.includes(g.url)) return g.url;
      }
    }
    return null;
  };

  // Explicit apply path: re-validate anchors against current HTML, verify the
  // preview hash (exact bytes the user previewed), then write atomically.
  // A logo edit also syncs organizations.logo_url (sign-in dashboard +
  // marketing demo read the org row, not built_html).
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
    const applyPromptText = [
      typeof (body as { prompt?: unknown }).prompt === "string" ? (body as { prompt: string }).prompt : prompt,
      typeof (body as { improvise?: unknown }).improvise === "string"
        ? (body as { improvise: string }).improvise
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const logoUrl = resolveLogoUrl(
      (body as { logo_url?: unknown }).logo_url ?? (body as { logoUrl?: unknown }).logoUrl,
      applyPromptText,
    );
    const update: Record<string, unknown> = { design_settings: { ...settings, built_html: next } };
    if (logoUrl) update.logo_url = logoUrl;
    await admin
      .from("organizations")
      .update(update)
      .eq("id", orgId);
    console.log(`[AI EDIT] applied ${checked.length} anchor edit(s) for org ${orgId}${logoUrl ? " + logo_url" : ""}`);
    return NextResponse.json({ applied: true, count: checked.length, logo_url: logoUrl });
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
      ? `Gallery images (name -> URL, use ONLY these URLs for any image request):\n${gallery.map((g, i) => `${i + 1}. "${g.name}" -> ${g.url}`).join("\n")}`
      : `Gallery images: none yet — if the request needs a brand-new image rather than an existing URL, return {"edits": []}.`,
    `Edit request: ${prompt.slice(0, 2000)}`,
    improvise ? `Additional creative direction (must also apply alongside the request): ${improvise.slice(0, 2000)}` : ``,
    `Current site HTML:`,
    builtHtml.slice(0, 100000),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await callGptSolHigh(modelInput, { system: EDIT_SYSTEM, maxOutputTokens: 10000, effort: "medium" });
    const jsonMatch = text.match(/\{[\s\S]*\}/)?.[0];
    let edits: AnchorEdit[] = [];
    let modelLogoUrl: string | null = null;
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
      if (parsed && typeof parsed === "object") {
        const rawLogo = (parsed as { logo_url?: unknown; logoUrl?: unknown }).logo_url ?? (parsed as { logoUrl?: unknown }).logoUrl;
        if (typeof rawLogo === "string" && galleryUrls.has(rawLogo)) modelLogoUrl = rawLogo;
      }
    } catch {
      edits = [];
    }
    const logoText = [prompt, improvise].filter(Boolean).join("\n");
    const logoUrl = modelLogoUrl ?? resolveLogoUrl(null, logoText);
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
      logo_url: logoUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Edit failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("OPENAI_API") ? 500 : 502 });
  }
}
