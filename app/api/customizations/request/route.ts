import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RestaurantSettings } from "@/types/customization";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { requested_changes, user_request_text, description } = body;

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id, organizations(slug)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  // Get current state to calculate proposed state
  const { data: cust } = await supabase
    .from("restaurant_customizations")
    .select("settings")
    .eq("org_id", staff.org_id)
    .maybeSingle();

  const currentSettings = (cust?.settings ?? {}) as RestaurantSettings;
  const proposedSettings = { ...currentSettings, ...requested_changes };

  // Create the request with user's plain text
  const { data, error } = await supabase
    .from("customization_requests")
    .insert({
      org_id: staff.org_id,
      requested_changes,
      proposed_settings: proposedSettings,
      user_request_text: user_request_text || null,
      description: description || null,
      status: 'pending'
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // The request is now pending. Hermes agent (main chat) will:
  // 1. Detect the pending request
  // 2. Invoke the Kiro-frontend subagent via delegate_task
  // 3. Subagent generates description, preview HTML, and code changes
  // 4. Main chat shows proposal for approval
  // 5. On approval, subagent applies changes
  
  return NextResponse.json({ 
    request: data[0],
    message: "Request submitted. A proposal will be generated for your review."
  });
}
