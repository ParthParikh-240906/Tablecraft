"use client";

import { useSearchParams } from "next/navigation";

/**
 * Renders the org name from the live ?org= URL param.
 * Uses the layout's userOrgs array to look up the name client-side,
 * so it stays fresh without a network request — same pattern as sidebar.
 */
export function HeaderOrg({
  userOrgs,
  fallback,
}: {
  userOrgs: { id: string; name: string }[];
  fallback: string;
}) {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org");
  const name =
    userOrgs.find((o) => o.id === orgId)?.name ??
    (orgId ? orgId.slice(0, 8) : fallback);
  return <>{name}</>;
}
