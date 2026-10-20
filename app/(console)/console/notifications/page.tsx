import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import type { InventoryNotification } from "@/types/inventory";
import { NotificationsList } from "./notifications-list";

export const dynamic = "force-dynamic";

export default async function ConsoleNotificationsPage({
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

  let initial: InventoryNotification[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("inventory_notifications")
      .select("*")
      .eq("org_id", orgId)
      .is("cleared_at", null)
      .in("status", ["unread", "read"])
      .order("created_at", { ascending: false })
      .limit(100);
    initial = (data ?? []) as InventoryNotification[];
  }

  return <NotificationsList orgId={orgId} initial={initial} />;
}
