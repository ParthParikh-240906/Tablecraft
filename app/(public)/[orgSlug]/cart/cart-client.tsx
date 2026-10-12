"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { normalizeCartConfig } from "@/lib/design";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};

export function CartClient({
  orgSlug,
  orgName,
  accent,
  menu,
  cartConfigRaw,
}: {
  orgSlug: string;
  orgName: string;
  accent: string;
  menu: MenuItem[];
  cartConfigRaw: unknown;
}) {
  const { lines, setQty, clear, count } = useCart(orgSlug);
  const cart = normalizeCartConfig(cartConfigRaw);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    cart.mode === "delivery" && cart.delivery_enabled ? "delivery" : "pickup",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const byId = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const detailed = useMemo(
    () =>
      Object.entries(lines)
        .map(([id, qty]) => ({ item: byId.get(id), qty }))
        .filter((r): r is { item: MenuItem; qty: number } => Boolean(r.item)),
    [lines, byId],
  );
  const subtotal = detailed.reduce((a, r) => a + Number(r.item.price) * r.qty, 0);
  const fee = fulfillment === "delivery" ? cart.delivery_fee : 0;
  const total = Math.round((subtotal + fee) * 100) / 100;

  async function checkout() {
    if (checkingOut) return;
    setError(null);
    if (detailed.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (cart.min_order > 0 && subtotal < cart.min_order) {
      setError(`Minimum order is AED ${cart.min_order}.`);
      return;
    }
    setCheckingOut(true);
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          items: detailed.map((r) => ({ id: r.item.id, quantity: r.qty })),
          fulfillment,
          customerName: name.trim(),
          customerPhone: phone.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(data?.error ?? "Checkout failed — please try again.");
        return;
      }
      clear();
      window.location.href = data.url;
    } catch {
      setError("Network error — please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-1">Your cart</h1>
      <p className="text-sm opacity-70 mb-6">{orgName} · {count} item{count === 1 ? "" : "s"}</p>

      {detailed.length === 0 ? (
        <p className="text-sm opacity-70">Your cart is empty.</p>
      ) : (
        <ul className="divide-y border-y">
          {detailed.map(({ item, qty }) => (
            <li key={item.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm opacity-70">AED {Number(item.price).toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty(item.id, qty - 1)} className="w-7 h-7 rounded-full border">−</button>
                <span className="w-6 text-center text-sm">{qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty(item.id, qty + 1)} className="w-7 h-7 rounded-full border">+</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {detailed.length > 0 && (
        <div className="mt-6 space-y-4">
          {cart.delivery_enabled ? (
            <div className="flex gap-2">
              {(["pickup", "delivery"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFulfillment(m)}
                  className="px-4 py-2 rounded-full border text-sm capitalize"
                  style={fulfillment === m ? { backgroundColor: accent, borderColor: accent, color: "#fff" } : undefined}
                >
                  {m}{m === "delivery" && cart.delivery_fee > 0 ? ` (+AED ${cart.delivery_fee})` : ""}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs opacity-70">Pickup only at this restaurant.</p>
          )}

          <div className="grid gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={100} className="border rounded px-3 py-2 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" maxLength={30} className="border rounded px-3 py-2 text-sm" />
          </div>

          <div className="text-sm space-y-1">
            <p>Subtotal: AED {subtotal.toFixed(2)}</p>
            {fee > 0 && <p>Delivery fee: AED {fee.toFixed(2)}</p>}
            <p className="font-bold">Total: AED {total.toFixed(2)}</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="button"
            onClick={checkout}
            disabled={checkingOut}
            className="w-full py-3 rounded-full font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {checkingOut ? "Starting checkout…" : `Pay AED ${total.toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  );
}
