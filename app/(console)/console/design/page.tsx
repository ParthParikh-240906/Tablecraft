import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { getDesignData } from "@/lib/org";
import { CanvasPanel } from "./canvas-panel";

export default async function ConsoleDesignPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/console/login");
  const orgId = await getActiveOrgId(user.id) ?? "";

  if (!orgId) return null;

  const data = await getDesignData(orgId);
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold mb-2 text-[var(--ink)]">
        Design
      </h1>
      <p className="text-sm text-[var(--ink-soft)] mb-6">
        Header, page colors, and the layer canvas. Hero content, content
        sections, and AI images live on their own pages.
      </p>
      <CanvasPanel
        orgId={orgId}
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
        }}
        paragraphs={data.paragraphs}
      />
    </div>
  );
}