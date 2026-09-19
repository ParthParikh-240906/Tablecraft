"use client";

import { useSearchParams } from "next/navigation";

/**
 * Renders the active org slug from the live ?org= URL param.
 * Follows the same pattern as HeaderOrg so it stays fresh after sidebar switches.
 */
export function HeaderOrgSlug({
  userOrgs,
  fallbackSlug,
}: {
  userOrgs: { id: string; slug: string }[];
  fallbackSlug: string;
}) {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org");
  const slug =
    userOrgs.find((o) => o.id === orgId || o.slug === orgId)?.slug ?? fallbackSlug;
  return <>{slug}</>;
}
