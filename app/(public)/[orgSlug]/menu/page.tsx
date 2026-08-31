import { notFound } from "next/navigation";
import { getOrgBySlug, getMenuByOrg } from "@/lib/org";
import { MenuItems } from "./menu-items";

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
  const highlightColor = org.theme_secondary_color ?? "#f97316";
  const textColor = org.theme_text_color ?? "#f5f5f4";
  const isCleanSlate = org.theme_color === "#fafaf9";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Menu</h1>
      <p className={isCleanSlate ? "text-sm mb-8" : "text-[var(--ink-faint)] mb-8"}>
        Everything we're serving right now at {org.name}.
      </p>

      {menu.length === 0 ? (
        <div className={isCleanSlate ? "rounded-2xl border border-dashed p-10 text-center text-sm" : "rounded-2xl border border-dashed p-10 text-center text-[var(--ink-faint)]"}>
          <p className="font-medium">No menu items yet</p>
          <p className="text-sm mt-1">Check back soon — we're updating our menu.</p>
        </div>
      ) : (
        <MenuItems grouped={menu} accent={highlightColor} />
      )}
    </div>
  );
}