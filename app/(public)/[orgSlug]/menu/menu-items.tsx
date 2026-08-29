"use client";

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

  return (
    <div className="space-y-10">
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
                    ${Number(item.price).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      addItem({ id: item.id, name: item.name, price: Number(item.price) })
                    }
                    className="px-3 py-1.5 rounded-full text-white text-xs font-medium"
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