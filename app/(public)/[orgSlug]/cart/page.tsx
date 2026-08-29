"use client";

import { useCart } from "@/lib/cart";

export default function CartPage() {
  const { items, setQuantity, removeItem, total, count } = useCart();

  if (count === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-gray-600">
          Browse the menu and add something you like.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Your Cart</h1>

      <ul className="divide-y mb-6">
        {items.map((item) => (
          <li key={item.id} className="py-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium">{item.name}</h3>
              <p className="text-sm text-gray-500">
                ${Number(item.price).toFixed(2)} each
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(item.id, item.quantity - 1)}
                className="h-7 w-7 rounded-full border text-sm"
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
                className="h-7 w-7 rounded-full border text-sm"
                aria-label={`Increase ${item.name}`}
              >
                +
              </button>
              <span className="w-16 text-right font-semibold">
                ${(item.price * item.quantity).toFixed(2)}
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

      <div className="flex items-center justify-between border-t pt-4 mb-6">
        <span className="font-medium">
          Total ({count} {count === 1 ? "item" : "items"})
        </span>
        <span className="text-xl font-bold">${total.toFixed(2)}</span>
      </div>

      <button
        type="button"
        disabled
        className="w-full py-3 rounded-full bg-gray-300 text-gray-600 font-medium cursor-not-allowed"
        title="Checkout coming soon"
      >
        Checkout (coming soon)
      </button>
    </div>
  );
}