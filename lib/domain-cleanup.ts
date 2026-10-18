import { createAdminClient } from "@/lib/supabase/admin";
import { removeProjectDomain } from "@/lib/vercel-domains";
import { clearDomainCache } from "@/lib/domain-store";

/**
 * lib/domain-cleanup.ts — detach custom domains when a restaurant is removed
 * or its owner drops to Free. The DB row is marked removed immediately (the
 * proxy only serves status='active'), then Vercel is cleaned up best-effort.
 */

export async function removeDomainsForOrgIds(
  orgIds: string[],
  reason = "removed",
): Promise<{ removed: number; errors: string[] }> {
  const ids = Array.from(new Set(orgIds.filter(Boolean)));
  if (ids.length === 0) return { removed: 0, errors: [] };

  let rows: Array<{
    id: string;
    hostname: string;
    alternate_hostname: string | null;
  }> = [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_domains")
      .select("id, hostname, alternate_hostname")
      .in("org_id", ids)
      .neq("status", "removed");
    if (error) {
      console.error("removeDomainsForOrgIds lookup failed:", error);
      return { removed: 0, errors: [error.message] };
    }
    rows = (data ?? []) as typeof rows;
  } catch (err) {
    console.error("removeDomainsForOrgIds failed:", err);
    return { removed: 0, errors: ["lookup_failed"] };
  }

  if (rows.length === 0) return { removed: 0, errors: [] };

  const errors: string[] = [];
  for (const row of rows) {
    for (const hostname of [row.hostname, row.alternate_hostname].filter(Boolean) as string[]) {
      try {
        await removeProjectDomain(hostname);
      } catch (err) {
        console.error(`removeProjectDomain ${hostname} failed:`, err);
        errors.push(hostname);
      }
    }
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("organization_domains")
      .update({
        status: "removed",
        is_primary: false,
        last_error: errors.length > 0 ? `Vercel cleanup pending (${reason})` : null,
        updated_at: new Date().toISOString(),
      })
      .in("id", rows.map((r) => r.id));
    if (error) {
      console.error("removeDomainsForOrgIds DB update failed:", error);
      errors.push("db_update_failed");
    }
  } catch (err) {
    console.error("removeDomainsForOrgIds DB update failed:", err);
    errors.push("db_update_failed");
  }

  clearDomainCache();
  return { removed: rows.length, errors };
}

export async function removeDomainsForOrg(
  orgId: string,
  reason = "removed",
): Promise<{ removed: number; errors: string[] }> {
  return removeDomainsForOrgIds([orgId], reason);
}
