
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const { data: requests, error } = await supabase
    .from("customization_requests")
    .select("*")
    .eq("org_id", staff.org_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ requests });
}
