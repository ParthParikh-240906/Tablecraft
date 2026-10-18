import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getOrgBySlug, getMenuByOrg } from "@/lib/org";
import { hydrateSettings } from "@/lib/design";
import { CartClient } from "./cart-client";

export const revalidate = 60;

export default async function CartPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  if (!orgSlug || !/^[a-z0-9-]{1,80}$/i.test(orgSlug)) {
    notFound();
  }
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    notFound();
  }
  const basePath = (await headers()).get("x-tc-custom-domain") === "1" ? "" : `/${org.slug}`;
  // AI-built standalone site handles its own cart in-page (hash view) — the
  // settings-driven cart page would render empty/dark, so send users to the site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB row, loosely typed by supabase
  const builtDesign = hydrateSettings(org.design_settings as Record<string, any> | null | undefined);
  if (builtDesign.built_html) {
    redirect(basePath || "/");
  }
  const menu = (await getMenuByOrg(org.id)) ?? [];
  const flatMenu = menu.flatMap((g) => g.items);
  const design = (org.design_settings as Record<string, unknown> | null) ?? null;
  const highlightColor = org.theme_secondary_color ?? "#f97316";

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link href={`${basePath}/menu`} className="text-sm font-medium underline">
          <span aria-hidden="true">&larr;</span> Back to menu
        </Link>
      </div>
      <CartClient
        orgSlug={org.slug}
        orgName={org.name}
        accent={highlightColor}
        menu={flatMenu.map((m) => ({ id: m.id, name: m.name, description: m.description, price: Number(m.price) }))}
        cartConfigRaw={design?.cart_config}
      />
    </div>
  );
}
