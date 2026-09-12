import { createClient } from "@/lib/supabase/server";
import { getDesignData } from "@/lib/org";
import { HeroPanel } from "./hero-panel";

export default async function ConsoleDesignHeroPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();

  if (!staff?.org_id) return null;

  const data = await getDesignData(staff.org_id);
  if (!data) return null;

  const org = data.org;
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold mb-2 text-[var(--ink)]">
        Hero
      </h1>
      <p className="text-sm text-[var(--ink-soft)] mb-6">
        Hero background and the text/logo elements that sit on top of it.
      </p>
      <HeroPanel
        orgId={staff.org_id}
        orgName={data.orgName}
        initialSettings={data.settings}
        org={{
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