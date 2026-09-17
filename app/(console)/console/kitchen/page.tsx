import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { KitchenQueue } from "./kitchen-queue";

interface KitchenOrder {
  id: string;
  customer_name: string;
  items: { id: string; name: string; price: number; quantity: number }[];
  total: number;
  status: string;
  created_at: string;
}

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/console/login");
  const orgId = await getActiveOrgId(user.id, params.org) ?? "";

  // Auto-delete cancelled/failed orders older than 1 hour
  await supabase
    .from("orders")
    .delete()
    .in("status", ["cancelled", "failed"])
    .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .eq("org_id", orgId);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, customer_name, items, total, status, created_at")
    .eq("org_id", orgId)
    .not("status", "eq", "completed")
    .not("status", "eq", "paid")
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)]">Kitchen Queue</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-0.5">
          Open tickets in first-in-first-out order. Click a ticket to manage it.
        </p>
      </div>
      <KitchenQueue orgId={orgId} initialOrders={(orders as KitchenOrder[]) ?? []} />
    </div>
  );
}
