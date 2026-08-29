import { createClient } from "@/lib/supabase/server";
import { OrdersList } from "./orders-list";

export default async function ConsoleOrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();

  const orgId = staff?.org_id ?? "";

  const { data: orders } = await supabase
    .from("orders")
    .select("id, customer_name, total, status, created_at, stripe_session_id, items")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <OrdersList initialOrders={(orders as any) ?? []} />
    </div>
  );
}