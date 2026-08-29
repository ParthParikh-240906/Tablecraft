import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrgBySlug } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; orderId: string }>;
  searchParams: Promise<{ status?: string; session_id?: string }>;
}) {
  const { orgSlug, orderId } = await params;
  const { status } = await searchParams;

  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, customer_name, items, total, status, created_at, stripe_session_id")
    .eq("id", orderId)
    .eq("org_id", org.id)
    .single();

  if (error || !order) {
    notFound();
  }

  const isPaid = order.status === "paid" || status === "success";
  const items = (order.items as any[]) || [];

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="ticket p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
          ✓
        </div>

        <p className="label-caps text-[var(--accent)] mb-1">
          {isPaid ? "Payment Confirmed" : "Order Placed"}
        </p>
        <h1 className="font-display text-3xl font-bold mb-2 text-[var(--ink)]">
          Thank you, {order.customer_name}!
        </h1>
        <p className="text-xs text-[var(--ink-soft)] mb-6 font-mono">
          Order #{order.id.slice(0, 8)}
        </p>

        <div className="border-t border-b border-dashed border-[var(--rule)] py-4 my-6 text-left space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-[var(--ink)]">
                {item.quantity}× {item.name}
              </span>
              <span className="font-mono text-[var(--ink-soft)]">
                AED {(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}

          <div className="border-t border-[var(--rule)] pt-3 flex justify-between items-center font-bold text-base">
            <span className="text-[var(--ink)]">Total</span>
            <span className="font-mono text-[var(--ink)]">AED {Number(order.total).toFixed(2)}</span>
          </div>
        </div>

        <p className="text-xs text-[var(--ink-soft)] mb-8">
          Your order has been sent directly to the kitchen at {org.name}.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href={`/${org.slug}/menu`}
            className="btn btn-outline text-xs"
          >
            Back to Menu
          </Link>
          <Link
            href={`/${org.slug}`}
            className="btn btn-accent text-xs"
          >
            Restaurant Home
          </Link>
        </div>
      </div>
    </div>
  );
}