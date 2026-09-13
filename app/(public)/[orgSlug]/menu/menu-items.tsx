"use client";

import type { MenuPageDesign } from "@/lib/design";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
}

function inline(
  d: { fontFamily: string; fontSize: number; color: string; textAlign: string },
  extra?: React.CSSProperties,
): React.CSSProperties {
  return {
    fontFamily: d.fontFamily,
    fontSize: `${d.fontSize}px`,
    color: d.color,
    textAlign: d.textAlign as React.CSSProperties["textAlign"],
    ...extra,
  };
}

export function MenuItems({
  grouped,
  menuDesign,
}: {
  grouped: { category: string; items: MenuItem[] }[];
  menuDesign: MenuPageDesign;
}) {
  return (
    <div className="space-y-10">
      {grouped.map(({ category, items }) => (
        <section key={category}>
          <h2
            style={{
              ...inline(menuDesign.category_design, {
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "1rem",
              }),
            }}
          >
            {category}
          </h2>
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="py-4 flex items-start justify-between gap-4">
                <div>
                  <h3 style={{ ...inline(menuDesign.item_name_design, { fontWeight: 500 }) }}>{item.name}</h3>
                  {item.description && (
                    <p style={{ ...inline(menuDesign.item_description_design, { marginTop: "0.25rem" }) }}>
                      {item.description}
                    </p>
                  )}
                </div>
                <span style={{ ...inline(menuDesign.item_price_design, { fontWeight: 600, whiteSpace: "nowrap" }) }}>
                  AED {Number(item.price).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}