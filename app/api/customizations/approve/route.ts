
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // 2. Update live settings
  const { error: updateErr } = await supabase
    .from("restaurant_customizations")
    .upsert({ 
      org_id: req.org_id, 
      settings: req.proposed_settings, 
      updated_at: new Date().toISOString() 
    });

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  // 3. Mark request as approved
  await supabase
    .from("customization_requests")
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq("id", requestId);

  return NextResponse.json({ success: true });
}
