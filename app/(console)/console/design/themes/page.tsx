import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { getDesignData } from "@/lib/org";
import { ThemesPanel } from "./themes-panel";
export const dynamic = "force-dynamic";

export default async function ConsoleDesignThemesPage({
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
  const orgId = await getActiveOrgId(user.id, params.org) ?? "";
  if (!orgId) return null;

  const data = await getDesignData(orgId);
  if (!data) return null;

  const org = data.org;
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <h1 className="font-display text-2xl font-bold text-[var(--ink)]">
          Themes
        </h1>
        {data.slug && (
          <a
            href={`/${data.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline text-xs px-3 py-1.5"
          >
            Preview Site →
          </a>
        )}
      </div>
      <p className="text-sm text-[var(--ink-soft)] mb-6">
        One-click full-page looks — preview a theme below, then apply it to
        restyle the whole site at once. Your photos are kept.
      </p>
      <ThemesPanel key={orgId}
        orgId={orgId}
        orgName={data.orgName}
        orgSlug={data.slug ?? null}
        initialSettings={data.settings}
        orgContent={{
          name: org.name,
          tagline: org.tagline ?? null,
          logo_url: org.logo_url,
          about_title: org.about_title ?? null,
          about_text: org.about_text ?? null,
          contact_heading: org.contact_heading ?? null,
          location: org.location ?? null,
          contact_phone: org.contact_phone ?? null,
          contact_email: org.contact_email ?? null,
          contact_address: org.contact_address ?? null,
          restaurant_photos: (org.restaurant_photos as string[] | null) ?? [],
        }}
        paragraphs={data.paragraphs}
      />
    </div>
  );
}
