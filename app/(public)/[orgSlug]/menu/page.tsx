import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug, getMenuByOrg } from "@/lib/org";
import { defaultMenuPageDesign, type MenuPageDesign, type TextDesign } from "@/lib/design";
import { MenuItems } from "./menu-items";

/** Convert a TextDesign to inline styles (server-rendered, no container queries). */
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
  const textColor = org.theme_text_color ?? "#f5f5f4";
  const isCleanSlate = org.theme_color === "#fafaf9";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back to restaurant landing page */}
      <div className="mb-6">
        <Link
          href={`/${org.slug}`}
          className={isCleanSlate ? "inline-flex items-center gap-2 text-sm font-medium hover:underline" : "inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"}
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
        <MenuItems grouped={menu} menuDesign={menuDesign} />
      )}
    </div>
  );
}