import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrgId, getDesignData } from "@/lib/org";
import { ConfigPanel } from "./config-panel";
export const dynamic = "force-dynamic";

export default async function ConsoleConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/console/login");
  }

  const orgId = (await getActiveOrgId(user.id, params.org)) ?? "";
  if (!orgId) {
    redirect("/console/login");
  }

  const data = await getDesignData(orgId);
  if (!data) {
    redirect("/console");
  }

  // Fetch all orgs for the restaurant switcher
  const admin = createAdminClient();
  const { data: allStaffRows } = await admin
    .from("staff_users")
    .select("org_id, role, organizations(id, name, slug, logo_url, theme_color)")
    .eq("auth_user_id", user.id);

  const userOrgs = (allStaffRows ?? [])
    .map((r: any) => {
      const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return o ? { id: o.id, name: o.name, slug: o.slug, logo_url: o.logo_url } : null;
    })
    .filter(Boolean);

  return (
    <ConfigPanel
      orgId={orgId}
      orgName={data.org.name}
      initialSettings={data.settings}
      userOrgs={userOrgs as any}
    />
  );
}
