"use client";

import { useState, useRef } from "react";
import { useCart } from "@/lib/cart";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
}

export function MenuItems({
  grouped,
  accent,
}: {
  grouped: { category: string; items: MenuItem[] }[];
  accent: string;
}) {
  const { addItem } = useCart();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimer, setToastTimer] = useState<NodeJS.Timeout | null>(null);
  const lastClickRef = useRef<{ [itemId: string]: number }>({});

  const handleAddToCart = (item: MenuItem) => {
    const now = Date.now();
    const lastClick = lastClickRef.current[item.id] || 0;
    // Throttle consecutive clicks by 150ms to prevent accidental multi-clicks
    if (now - lastClick < 150) {
      return;
    }
    lastClickRef.current[item.id] = now;

    addItem({ id: item.id, name: item.name, price: Number(item.price) });

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    setToastMessage(`${item.name} added to cart`);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
    setToastTimer(timer);
  };

  return (
    <div className="space-y-10 relative">
      {/* Toast Notification - Centered at the bottom */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 pointer-events-none">
          <div className="bg-[var(--paper-raised)] text-[var(--ink)] border border-[var(--rule)] shadow-2xl rounded-full px-5 py-3 flex items-center gap-3 text-sm font-medium pointer-events-auto">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {grouped.map(({ category, items }) => (
        <section key={category}>
          <h2
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: accent }}
          >
            {category}
          </h2>
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="py-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <span className="font-semibold">
                    AED {Number(item.price).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(item)}
                    className="px-3 py-1.5 rounded-full text-white text-xs font-medium transition-transform active:scale-95 shadow-sm"
                    style={{ backgroundColor: accent }}
                  >
                    Add
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
