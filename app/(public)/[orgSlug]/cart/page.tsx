"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useCart } from "@/lib/cart";
import Link from "next/link";

export default function CartPage() {
  const { items, setQuantity, removeItem, total, count, isLoaded } = useCart();
  const params = useParams();
  const orgSlug = typeof params?.orgSlug === "string" ? params.orgSlug : "";

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) {
      setError("Please enter your name for the order.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate checkout");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center text-sm text-gray-400">
        Loading cart…
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-3 text-white">Your cart is empty</h1>
        <p className="text-gray-400 mb-6">
          Browse the menu and add something delicious to your order.
        </p>
        <Link
          href={`/${orgSlug}/menu`}
          className="btn btn-accent inline-block"
        >
          Explore Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl font-bold mb-6 text-white">Cart</h1>

      <ul className="divide-y divide-[var(--rule)] mb-6">
        {items.map((item) => (
          <li key={item.id} className="py-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-white">{item.name}</h3>
              <p className="text-xs text-gray-400">
                AED {Number(item.price).toFixed(2)} each
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(item.id, item.quantity - 1)}
                className="h-7 w-7 rounded-full border border-[var(--rule)] text-sm flex items-center justify-center hover:bg-[var(--paper-raised)]"
                aria-label={`Decrease ${item.name}`}
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(item.id, item.quantity + 1)}
                className="h-7 w-7 rounded-full border border-[var(--rule)] text-sm flex items-center justify-center hover:bg-[var(--paper-raised)]"
                aria-label={`Increase ${item.name}`}
              >
                +
              </button>
              <span className="w-24 text-right font-semibold">
                AED {(item.price * item.quantity).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-xs text-red-500 hover:underline"
                aria-label={`Remove ${item.name}`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-gray-700 pt-4 mb-8">
        <span className="font-medium text-white">
          Total ({count} {count === 1 ? "item" : "items"})
        </span>
        <span className="text-2xl font-bold font-display text-white">
          AED {total.toFixed(2)}
        </span>
      </div>

      <form onSubmit={handleCheckout} className="ticket p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-black">Order Details</h2>
        
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-xs rounded-sm">
            {error}
          </div>
        )}

        <div>
          <label className="label-caps block text-gray-400 mb-1">Your Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Alex Smith"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label-caps block text-gray-400 mb-1">Email (for receipt)</label>
          <input
            type="email"
            placeholder="alex@example.com"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-accent w-full py-3 mt-4 text-center cursor-pointer"
        >
          {loading ? "Preparing Secure Checkout..." : `Pay AED ${total.toFixed(2)} with Card`}
        </button>

        <p className="text-center text-[10px] text-[var(--ink-faint)] mt-2">
          Payments are securely processed by Stripe.
        </p>
      </form>
    </div>
  );
}
