import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { MenuManager } from "./menu-manager";

export default async function ConsoleMenuPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgId = await getActiveOrgId(user!.id) ?? "";

  return <MenuManager orgId={orgId} />;
}