import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrgId } from "@/lib/org";
import { getCapacityPlan, isFreeGated } from "@/lib/capacity";
import { getDomainsForOrg } from "@/lib/domain-store";
import { removeDomainsForOrg } from "@/lib/domain-cleanup";
import { isVercelConfigured } from "@/lib/vercel-domains";
import { getPlatformBaseUrl } from "@/lib/site-url";
import { LaunchClient } from "./launch-client";

export const dynamic = "force-dynamic";

export default async function ConsoleLaunchPage({
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
  if (!orgId) redirect("/console/login");

  const admin = createAdminClient();
  const { data: staffRows } = await admin
    .from("staff_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .eq("org_id", orgId);
  const isOwner = (staffRows ?? []).some((r: { role?: string }) => r.role === "owner");
  if (!isOwner) redirect(`/console?org=${orgId}`);

  const { data: org } = await admin
    .from("organizations")
    .select("name, slug")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) redirect("/console");

  const plan = await getCapacityPlan(orgId);
  const { error: schemaError } = await admin
    .from("organization_domains")
    .select("id")
    .limit(1);
  const schemaReady = !schemaError;
  if (schemaError) console.error("Launch page domain schema check failed:", schemaError);

  // Free-plan backstop: if a downgrade webhook was missed, detach any domains
  // before rendering so the Free rule is enforced immediately.
  let domains = await getDomainsForOrg(orgId);
  if (isFreeGated(plan) && domains.length > 0) {
    await removeDomainsForOrg(orgId, "free_plan");
    domains = [];
  }

  return (
    <LaunchClient
      orgId={orgId}
      orgSlug={org.slug}
      orgName={org.name}
      plan={plan.plan}
      domains={domains}
      platformBaseUrl={getPlatformBaseUrl()}
      vercelConfigured={isVercelConfigured()}
      schemaReady={schemaReady}
    />
  );
}
