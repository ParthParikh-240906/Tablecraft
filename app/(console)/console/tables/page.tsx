import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { TableGrid } from "./table-grid";

export default async function TablesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/console/login");

  const orgId = await getActiveOrgId(user!.id) ?? "";

  if (!orgId) redirect("/console/login");

  return <TableGrid orgId={orgId} />;
}