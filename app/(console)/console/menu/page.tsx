import { createClient } from "@/lib/supabase/server";
import { MenuManager } from "./menu-manager";

export default async function ConsoleMenuPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();

  return <MenuManager orgId={staff?.org_id ?? ""} />;
}