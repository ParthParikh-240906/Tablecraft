import { notFound } from "next/navigation";
import { getOrgBySlug, getMenuByOrg } from "@/lib/org";

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
  const accent = org.theme_color ?? "#f97316";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Menu</h1>
      <p className="text-gray-600 mb-8">
        Everything we're serving right now at {org.name}.
      </p>

      {menu.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
          <p className="font-medium">No menu items yet</p>
          <p className="text-sm mt-1">Check back soon — we're updating our menu.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {menu.map(({ category, items }) => (
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
                    <span className="font-semibold whitespace-nowrap">
                      ${Number(item.price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}