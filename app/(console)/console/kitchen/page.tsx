import { createClient } from "@/lib/supabase/server";
import { KitchenQueue } from "./kitchen-queue";

interface KitchenOrder {
  id: string;
  customer_name: string;
  items: { id: string; name: string; price: number; quantity: number }[];
  total: number;
  status: string;
  created_at: string;
}

export default async function KitchenPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();
  const orgId = staff?.org_id ?? "";

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
