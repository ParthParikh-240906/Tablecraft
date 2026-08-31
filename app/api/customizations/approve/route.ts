
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Owner approves a customization request.
 *
 * Writes the proposed settings two places so they actually reach the live site:
 *   1. restaurant_customizations.settings (the structured record)
 *   2. organizations.theme_* columns (what the public page currently renders)
 */
export async function POST(request: Request) {
  const supabase = await createAdminClient();
  const { requestId } = await request.json();

  // 1. Get the request
  const { data: req, error: reqErr } = await supabase
    .from("customization_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqErr || !req) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const settings = req.proposed_settings ?? {};

  // 2. Update live structured settings
  const { error: updateErr } = await supabase
    .from("restaurant_customizations")
    .upsert({
      org_id: req.org_id,
      settings,
      updated_at: new Date().toISOString(),
    });

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  // 3. Sync the colors/styles into the org columns the public page renders
  const orgPatch: Record<string, unknown> = {};
  if (settings.backgroundColor || settings.primaryColor) {
    orgPatch.theme_color = settings.backgroundColor || settings.primaryColor;
  }
  if (settings.primaryColor && !settings.backgroundColor) {
    // primary acts as theme color if no explicit background given
  }
  if (settings.accentColor) {
    orgPatch.theme_secondary_color = settings.accentColor;
  }

  if (Object.keys(orgPatch).length > 0) {
    const { error: orgErr } = await supabase
      .from("organizations")
      .update(orgPatch)
      .eq("id", req.org_id);
    if (orgErr) {
      return NextResponse.json({ error: `Customization saved, but theme sync failed: ${orgErr.message}` }, { status: 400 });
    }
  }

  // 4. Mark request as approved
  await supabase
    .from("customization_requests")
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq("id", requestId);

  return NextResponse.json({ success: true });
}
