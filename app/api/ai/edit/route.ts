import { NextResponse } from "next/server";
import { callGptSolHigh } from "@/lib/ai-models";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { assertPatches, type FilePatch } from "@/lib/ai-code-tools";

const EDIT_SYSTEM = `You are Tablecraft's editing model (GPT 6.1 Sol, high effort).
Hard rules:
- Pinpoint the exact lines of code causing the issue and fix only those (return file:line refs).
- If the prompt asks for an aesthetic/vibe change, do it FIRST (site-themes applySiteTheme / design tokens) before minor edits.
- Use scalable patterns: menu_items table, restaurant_photos[], design_settings.ref — never hardcode.
- Return ONLY valid JSON: {"files": [{"path": "...", "lines": "file:line", "diff": "..."}], "applied": false}`;

/**
 * POST /api/ai/edit
 * Body: { orgId, prompt, improvise?, preview?: boolean, patches?: FilePatch[] }
 * Preview by default; pass preview:false + patches to apply (applies via design settings only in v1).
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

  // Explicit apply path validates patch shape (v1: no direct FS write; client applies via design APIs)
  if (body.preview === false && body.patches) {
    try {
      assertPatches(body.patches as FilePatch[]);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid patches" }, { status: 400 });
    }
    return NextResponse.json({ applied: false, message: "Apply via console approve flow (design APIs)", count: (body.patches as unknown[]).length });
  }

  const fullPrompt = [
    `orgId: ${orgId}`,
    `Edit request: ${prompt.slice(0, 2000)}`,
    improvise ? `Improvisation hint (apply creatively): ${improvise.slice(0, 2000)}` : ``,
    `If vibe/aesthetic change requested, do theme first, then minors. Pinpoint exact file:line.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await callGptSolHigh(fullPrompt, { system: EDIT_SYSTEM, maxOutputTokens: 100000 });
    return NextResponse.json({ model: "gpt-6.1-sol", effort: "high", preview: true, raw: text.slice(0, 20000) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Edit failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("OPENAI_API") ? 500 : 502 });
  }
}
