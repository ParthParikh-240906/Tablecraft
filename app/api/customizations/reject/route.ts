import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await request.json();
  
  if (!requestId) {
    return NextResponse.json({ error: "Request ID required" }, { status: 400 });
  }

  // Verify user owns this request
  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  // Update request status
  const { error } = await supabase
    .from("customization_requests")
    .update({ 
      status: 'rejected',
      reviewed_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("org_id", staff.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
