import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug, getMenuByOrg } from "@/lib/org";
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
  const menu = (await getMenuByOrg(org.id)) ?? [];
  const flatMenu = menu.flatMap((g) => g.items);
  const design = (org.design_settings as Record<string, unknown> | null) ?? null;
  const highlightColor = org.theme_secondary_color ?? "#f97316";

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link href={`/${org.slug}/menu`} className="text-sm font-medium underline">
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
