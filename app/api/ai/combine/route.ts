import { NextResponse } from "next/server";
import { callGptSolHigh } from "@/lib/ai-models";
import { requireStaffForOrgId } from "@/lib/api-auth";

const COMBINE_SYSTEM = `You are Tablecraft's combination model (GPT 6.1 Sol, high effort).
Hard rules:
- Connect Menu section and Book a table endpoints to their respective places in console (menu-manager + booking-actions).
- The restaurant website must keep orgSlug in its endpoint URLs (/{orgSlug}, /{orgSlug}/menu, /{orgSlug}/reserve, POST /api/bookings {orgSlug}).
- You may read and write lines of code but you MUST NOT change the design of the website (colors, fonts, layout, DesignSettingsV2 stay identical).
- Return ONLY valid JSON: {"files": [{"path": "...", "lines": "file:line", "diff": "..."}], "tests": ["..."]}`;

/**
 * POST /api/ai/combine
 * Body: { orgId, orgSlug }
 * GPT 6.1 Sol high effort via Responses API. Staff-gated. Preview only (no write).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug : "";
  if (!orgId || !orgSlug) return NextResponse.json({ error: "orgId and orgSlug are required" }, { status: 400 });
  const auth = await requireStaffForOrgId(orgId);
  if ("response" in auth) return auth.response;

  const prompt = [
    `orgId: ${orgId}`,
    `orgSlug: ${orgSlug}`,
    `Wire getMenuByOrg -> console/menu/menu-manager.tsx and POST /api/bookings -> console/bookings/booking-actions.tsx + BookingChatbot.tsx.`,
    `Keep all design_settings identical. Public URLs must keep /${orgSlug}.`,
    `List exact file:line patches as preview (do not apply).`,
  ].join("\n");

  try {
    const text = await callGptSolHigh(prompt, { system: COMBINE_SYSTEM, maxOutputTokens: 6000 });
    return NextResponse.json({ model: "gpt-6.1-sol", effort: "high", preview: true, raw: text.slice(0, 20000) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Combine failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("OPENAI_API") ? 500 : 502 });
  }
}
