import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { InventoryManager } from "./inventory-manager";

export const dynamic = "force-dynamic";

export default async function ConsoleInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/console/login");
  const orgId = (await getActiveOrgId(user.id, params.org)) ?? "";

  return <InventoryManager orgId={orgId} initialFilter={params.filter ?? "all"} />;
}
