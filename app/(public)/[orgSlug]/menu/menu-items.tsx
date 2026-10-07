"use client";

import type { MenuPageDesign, ResponsiveOverrides } from "@/lib/design";
import { getShadowStyle, resolveFontSize } from "@/lib/design";
import { useViewportDevice } from "@/lib/use-device";

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
  responsive,
}: {
  grouped: { category: string; items: MenuItem[] }[];
  menuDesign: MenuPageDesign;
  shapes?: ShapeElement[];
  responsive?: ResponsiveOverrides | null;
}) {
  const device = useViewportDevice();
  // Resolve a menu.* per-device override, then the usual inline styles.
  const rinline = (
    d: { fontFamily: string; fontSize: number; color: string; textAlign: string; shadow?: { color: string; direction: number; length: number; opacity?: number } },
    key: string,
    extra?: React.CSSProperties,
  ): React.CSSProperties =>
    inline({ ...d, fontSize: resolveFontSize(d.fontSize, key, device, responsive) }, extra);
  // Accent-gradient word treatment (shares OrgPageView's .gradient-text).
  const gcls = (d: { gradient?: boolean }): string | undefined =>
    d.gradient ? "gradient-text" : undefined;
  const safeGrouped = Array.isArray(grouped) ? grouped : [];
  function formatPrice(price: unknown): string {
    const n = Number(price);
    if (!Number.isFinite(n)) return "AED —";
    return `AED ${n.toFixed(2)}`;
  }
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
        {safeGrouped.map(({ category, items }) => (
          <section
            key={category}
            className={`rounded-lg p-5${menuDesign.hover_lift !== false ? " transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" : ""}`}
            style={{
              backgroundColor: "#ffffff",
              border: `${menuDesign.border_width}px solid ${menuDesign.border_color}`,
            }}
          >
            <h2
              className={gcls(menuDesign.category_design)}
              style={{
                ...rinline(menuDesign.category_design, "menu.category", {
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
                    <h3 className={gcls(menuDesign.item_name_design)} style={{ ...rinline(menuDesign.item_name_design, "menu.item_name", { fontWeight: 500 }) }}>{item.name}</h3>
                    {item.description && (
                      <p className={gcls(menuDesign.item_description_design)} style={{ ...rinline(menuDesign.item_description_design, "menu.item_description", { marginTop: "0.25rem" }) }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className={gcls(menuDesign.item_price_design)} style={{ ...rinline(menuDesign.item_price_design, "menu.item_price", { fontWeight: 600, whiteSpace: "nowrap" }) }}>
                    {formatPrice(item.price)}
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

/**
 * Client headings for the menu page title/subtitle (menu.title,
 * menu.subtitle). The server page (`menu/page.tsx`) renders these today, so
 * it needs a one-line change to render `<MenuHeadings …/>` instead of its
 * static `<h1>`/`<p>` for the overrides to apply on tablet/mobile.
 */
export function MenuHeadings({
  menuDesign,
  responsive,
  orgName,
}: {
  menuDesign: MenuPageDesign;
  responsive?: ResponsiveOverrides | null;
  orgName: string;
}) {
  const device = useViewportDevice();
  return (
    <>
      <h1
        className={menuDesign.title_design.gradient ? "gradient-text" : undefined}
        style={inline(
          {
            ...menuDesign.title_design,
            fontSize: resolveFontSize(menuDesign.title_design.fontSize, "menu.title", device, responsive),
          },
          { fontWeight: 700, marginBottom: "0.5rem" },
        )}
      >
        Menu
      </h1>
      <p
        className={menuDesign.subtitle_design.gradient ? "gradient-text" : undefined}
        style={inline(
          {
            ...menuDesign.subtitle_design,
            fontSize: resolveFontSize(menuDesign.subtitle_design.fontSize, "menu.subtitle", device, responsive),
          },
          { marginBottom: "2rem" },
        )}
      >
        Everything we&apos;re serving right now at {orgName}.
      </p>
    </>
  );
}