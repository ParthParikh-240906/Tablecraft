"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface HeaderNavProps {
  isOwner: boolean;
  userOrgs: OrgInfo[];
  fallbackSlug: string;
  notificationCount?: number;
  lowStockCount?: number;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function HeaderNav({
  isOwner,
  userOrgs,
  fallbackSlug,
  notificationCount = 0,
  lowStockCount = 0,
}: HeaderNavProps) {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org");
  const orgParam = orgId ? `?org=${orgId}` : "";
  const currentOrg = orgId
    ? userOrgs.find((o) => o.id === orgId || o.slug === orgId)
    : userOrgs.find((o) => o.slug === fallbackSlug) || userOrgs[0];
  const slug = currentOrg?.slug ?? fallbackSlug;

  return (
    <>
      <nav className="flex items-center gap-3 flex-wrap">
        <Link href={`/console${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
          Dashboard
        </Link>
        <Link href={`/console/tables${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
          Tables
        </Link>
        <Link href={`/console/bookings${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
          Reservations
        </Link>
        <Link href={`/console/orders${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
          Orders
        </Link>
        <Link href={`/console/kitchen${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
          Kitchen
        </Link>
        <Link href={`/console/menu${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
          Menu
        </Link>
        <Link href={`/console/inventory${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs inline-flex items-center">
          Inventory
          <Badge count={lowStockCount} />
        </Link>
        <Link
          href={`/console/notifications${orgParam}`}
          className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs inline-flex items-center"
        >
          Notifications
          <Badge count={notificationCount} />
        </Link>
        {isOwner && (
          <Link href={`/console/design${orgParam}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
            Design
          </Link>
        )}
      </nav>
      <span className="text-[var(--rule)]">|</span>
      {slug && (
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline font-medium text-xs">
          Public Storefront →
        </a>
      )}
      {isOwner && (
        <>
          <span className="text-[var(--rule)]">|</span>
          <Link href="/dashboard" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors text-xs">
            Sign-in Dashboard
          </Link>
        </>
      )}
    </>
  );
}
