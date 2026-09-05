import { createClient } from "@/lib/supabase/server";
import { DesignPanel } from "./design-panel";

export default async function ConsoleDesignPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id, organizations!inner(name, slug)")
    .eq("auth_user_id", user?.id ?? "")
    .single();

  if (!staff?.org_id) return null;

  const orgName = Array.isArray(staff.organizations)
    ? (staff.organizations as any[])[0]?.name ?? ""
    : (staff.organizations as any)?.name ?? "";

  // Fetch org design settings + paragraphs
  const { data: paragraphs } = await supabase
    .from("paragraphs")
    .select("id, position, title, content, image_url, image_position, title_design, content_design")
    .eq("org_id", staff.org_id)
    .order("position", { ascending: true });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold mb-8 text-[var(--ink)]">
        Storefront Designer
      </h1>
      <DesignPanel
        orgId={staff.org_id}
        orgName={orgName}
        paragraphs={paragraphs ?? []}
      />
    </div>
  );
}
