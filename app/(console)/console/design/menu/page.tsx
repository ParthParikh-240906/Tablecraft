import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { getDesignData } from "@/lib/org";
import { MenuPagePanel } from "./menu-page-panel";

export default async function ConsoleDesignMenuPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  

  const orgId = await getActiveOrgId(user!.id) ?? "";
  if (!orgId) return null;

  const data = await getDesignData(orgId);
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold mb-2 text-[var(--ink)]">
        Menu Page
      </h1>
      <p className="text-sm text-[var(--ink-soft)] mb-6">
        Style the public menu page — headings, categories, and items.
      </p>
      <MenuPagePanel
        orgId={orgId}
        orgName={data.orgName}
        initialSettings={data.settings}
      />
    </div>
  );
}