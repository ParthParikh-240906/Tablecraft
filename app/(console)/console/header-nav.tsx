"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HeaderOrgSlug } from "./header-org-slug";

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface HeaderNavProps {
  isOwner: boolean;
  userOrgs: OrgInfo[];
  fallbackSlug: string;
}

export function HeaderNav({ isOwner, userOrgs, fallbackSlug }: HeaderNavProps) {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org");
  const orgParam = orgId ? `?org=${orgId}` : "";
  const currentOrg = userOrgs.find((o) => o.id === orgId) || userOrgs[0];
  const slug = currentOrg?.slug ?? fallbackSlug;

  return (
    <>
      <nav className="flex items-center gap-3">
        <Link href={`/console${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          Dashboard
        </Link>
        <Link href={`/console/tables${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          Tables
        </Link>
        <Link href={`/console/bookings${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          Bookings
        </Link>
        <Link href={`/console/orders${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          Orders
        </Link>
        <Link href={`/console/kitchen${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          Kitchen
        </Link>
        <Link href={`/console/menu${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          Menu
        </Link>
        {isOwner && (
          <Link href={`/console/design${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
            Design
          </Link>
        )}
      </nav>
      <span className="text-[var(--rule)]">|</span>
      {slug && (
        <Link href={`/${slug}`} className="text-[var(--accent)] hover:underline font-medium">
          Public Storefront →
        </Link>
      )}
    </>
  );
}
