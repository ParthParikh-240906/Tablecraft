
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the org_id for this user from staff_users
  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const { data: cust } = await supabase
    .from("restaurant_customizations")
    .select("settings")
    .eq("org_id", staff.org_id)
    .maybeSingle();

  return NextResponse.json({ settings: cust?.settings ?? {} });
}
