"use client";

import type { MenuPageDesign } from "@/lib/design";
import { getShadowStyle } from "@/lib/design";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
}

interface ShapeElement {
  id: string;
  style: {
    color?: string;
    opacity?: number;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
  };
}

function inline(
  d: { fontFamily: string; fontSize: number; color: string; textAlign: string; shadow?: { color: string; direction: number; length: number; opacity?: number } },
  extra?: React.CSSProperties,
): React.CSSProperties {
  return {
    fontFamily: d.fontFamily,
    fontSize: `${d.fontSize}px`,
    color: d.color,
    textAlign: d.textAlign as React.CSSProperties["textAlign"],
    textShadow: getShadowStyle(d.shadow),
    ...extra,
  };
}

export function MenuItems({
  grouped,
  menuDesign,
  shapes,
}: {
  grouped: { category: string; items: MenuItem[] }[];
  menuDesign: MenuPageDesign;
  shapes?: ShapeElement[];
}) {
  return (
    <div className="relative">
      {/* Background shapes (rendered first = behind everything) */}
      {shapes?.map((shape) => (
        <div
          key={shape.id}
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: shape.style.color,
            opacity: (shape.style.opacity ?? 100) / 100,
            border: shape.style.borderWidth
              ? `${shape.style.borderWidth}px solid ${shape.style.borderColor ?? "#ffffff"}`
              : undefined,
            borderRadius: shape.style.borderRadius ? `${shape.style.borderRadius}%` : undefined,
          }}
        />
      ))}

      <div className="space-y-10" style={{ position: "relative", zIndex: 1 }}>
        {grouped.map(({ category, items }) => (
          <section
            key={category}
            className="rounded-lg p-5"
            style={{
              backgroundColor: "#ffffff",
              border: `${menuDesign.border_width}px solid ${menuDesign.border_color}`,
            }}
          >
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
    </div>
  );
}