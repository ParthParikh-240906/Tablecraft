import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TableGrid } from "./table-grid";

export default async function TablesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/console/login");

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff) redirect("/console/login");

  return <TableGrid orgId={staff.org_id} />;
}