import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDesign } from "@/lib/kiro-design";

/**
 * Generate a design for a pending customization request using Kiro-frontend.
 *
 * Flow:
 *   1. Owner submits a request → stored as status 'processing'
 *   2. This route reads the request + org context, calls Kiro-frontend
 *   3. Kiro elaborates the prompt and produces design decisions + preview HTML
 *   4. Result is persisted and the request moves to status 'pending_review'
 *      (hidden from owner until Hermes reviews and approves it)
 *
 * Body: { requestId }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await request.json();
  if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });

  // Fetch the request + verify ownership
  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!staff) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const { data: req, error: reqErr } = await supabase
    .from("customization_requests")
    .select("*")
    .eq("id", requestId)
    .eq("org_id", staff.org_id)
    .single();
  if (reqErr || !req) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  // Fetch org for context
  const { data: org } = await supabase
    .from("organizations")
    .select("name, slug, theme_color, theme_text_color, theme_secondary_color, logo_url, tagline")
    .eq("id", staff.org_id)
    .maybeSingle();

  const currentSettings = req.proposed_settings != null
    ? (typeof req.proposed_settings === "string" ? JSON.parse(req.proposed_settings) : req.proposed_settings)
    : {};

  const orgName = org?.name || "Your Restaurant";
  const orgSlug = org?.slug || "";
  const userRequestText = req.user_request_text || req.description || "";

  // Drag back the status to processing
  await supabase
    .from("customization_requests")
    .update({ status: "processing" })
    .eq("id", requestId);

  try {
    const design = await generateDesign({
      orgName,
      orgSlug,
      currentSettings,
      userRequestText,
      currentSiteContext: {
        themeColor: org?.theme_color || "#141414",
        textColor: org?.theme_text_color || "#f5f5f4",
        highlightColor: org?.theme_secondary_color || "#f97316",
        fontFamily: "",
        logoUrl: org?.logo_url || undefined,
        tagline: org?.tagline || undefined,
      },
    });

    if (design.refusal) {
      await supabase
        .from("customization_requests")
        .update({ status: "rejected", description: design.refusal })
        .eq("id", requestId);
      return NextResponse.json({
        status: "refused",
        refusal: design.refusal,
        requestId,
      });
    }

    // Merge delta onto current to produce the full proposed settings
    const proposedSettings = { ...currentSettings, ...design.settingsDelta };

    await supabase
      .from("customization_requests")
      .update({
        status: "pending_review",
        description: design.description,
        preview_html: design.previewHtml,
        requested_changes: design.settingsDelta,
        proposed_settings: proposedSettings,
      })
      .eq("id", requestId);

    return NextResponse.json({
      status: "pending_review",
      requestId,
      message: "Design generated. Awaiting review before it is shown to the owner.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    await supabase
      .from("customization_requests")
      .update({ status: "failed", description: `Generation failed: ${msg}` })
      .eq("id", requestId);
    return NextResponse.json(
      { error: "Design generation failed", detail: msg },
      { status: 500 }
    );
  }
}
