import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug, getMenuByOrg } from "@/lib/org";
import { defaultMenuPageDesign, type MenuPageDesign, type TextDesign, getShadowStyle } from "@/lib/design";
import { MenuItems } from "./menu-items";

// Cache for 60s — menu content doesn't change that often
export const revalidate = 60;

/** Convert a TextDesign to inline styles (server-rendered, no container queries). */
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

export default async function MenuPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  const menu = await getMenuByOrg(org.id);
  const menuDesign: MenuPageDesign = org.design_settings
    ? { ...defaultMenuPageDesign(), ...((org.design_settings as Record<string, unknown>)?.menu_page as Partial<MenuPageDesign> ?? {}) }
    : defaultMenuPageDesign();
  const menuShapes = (org.design_settings as Record<string, unknown>)?.menu_page_shapes as { id: string; style: { color?: string; opacity?: number; borderWidth?: number; borderColor?: string; borderRadius?: number } }[] | undefined;
  const textColor = org.theme_text_color ?? "#f5f5f4";
  const isCleanSlate = org.theme_color === "#fafaf9";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back to restaurant landing page */}
      <div className="mb-6">
        <Link
          href={`/${org.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium underline"
          style={{ color: menuDesign.back_button_color ?? "#ffffff" }}
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to {org.name}</span>
        </Link>
      </div>

      <h1 style={inline(menuDesign.title_design, { fontWeight: 700, marginBottom: "0.5rem" })}>Menu</h1>
      <p style={inline(menuDesign.subtitle_design, { marginBottom: "2rem" })}>
        Everything we're serving right now at {org.name}.
      </p>

      {menu.length === 0 ? (
        <div className={isCleanSlate ? "rounded-2xl border border-dashed p-10 text-center text-sm" : "rounded-2xl border border-dashed p-10 text-center text-[var(--ink-faint)]"}>
          <p className="font-medium">No menu items yet</p>
          <p className="text-sm mt-1">Check back soon — we're updating our menu.</p>
        </div>
      ) : (
        <MenuItems grouped={menu} menuDesign={menuDesign} shapes={menuShapes} />
      )}
    </div>
  );
}
