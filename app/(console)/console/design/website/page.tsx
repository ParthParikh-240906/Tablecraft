import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrgId, getDesignData } from "@/lib/org";
import { DesignDeviceProvider } from "../design-device";
import { DesignNav } from "../design-nav";
import { WebsiteClient } from "./website-client";
import { ViewSiteLink } from "@/components/ViewSiteLink";
export const dynamic = "force-dynamic";

export default async function ConsoleDesignWebsitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/console/login");
  const orgId = (await getActiveOrgId(user.id, params.org)) ?? "";
  if (!orgId) return null;

  const admin = createAdminClient();
  const { data: staffRow } = await admin
    .from("staff_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .eq("org_id", orgId)
    .single();
  if (staffRow?.role !== "owner") redirect(`/console${orgId ? `?org=${orgId}` : ""}`);

  const data = await getDesignData(orgId);
  if (!data) return null;

  const { data: menuRows } = await admin
    .from("menu_items")
    .select("id, name, price, category, description")
    .eq("org_id", orgId)
    .eq("available", true)
    // Same sequence as /console/menu: category groups, then item order.
    .order("category_sort_order", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold mb-1 text-[var(--ink)]">Website</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Describe edits in the prompt. Preview on desktop / tablet / mobile.
          </p>
        </div>
        {data.org.slug && (
          <ViewSiteLink href={`/${data.org.slug}`} className="btn btn-outline text-xs px-3 py-1.5">
            Preview Site →
          </ViewSiteLink>
        )}
      </div>
      <DesignNav />
      <DesignDeviceProvider>
        <WebsiteClient
          orgId={orgId}
          orgSlug={data.org.slug ?? ""}
          orgName={data.orgName}
          initialSettings={data.settings}
          org={{
            name: data.org.name,
            tagline: data.org.tagline ?? null,
            logo_url: data.org.logo_url,
            about_title: data.org.about_title ?? null,
            about_text: data.org.about_text ?? null,
            contact_heading: data.org.contact_heading ?? null,
            location: data.org.location ?? null,
            contact_phone: data.org.contact_phone ?? null,
            contact_email: data.org.contact_email ?? null,
            contact_address: data.org.contact_address ?? null,
            restaurant_photos: (data.org.restaurant_photos as string[] | null) ?? [],
            background_image_url: (data.org as { background_image_url?: unknown }).background_image_url as string | null ?? null,
          }}
          paragraphs={data.paragraphs}
          menuItems={((menuRows ?? []) as { id: string; name: string; price: number; category: string | null; description: string | null }[]).filter((r) => r && typeof r.id === "string")}
        />
      </DesignDeviceProvider>
    </div>
  );
}
