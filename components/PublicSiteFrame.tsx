"use client";

import { usePathname } from "next/navigation";
import { PublicSiteHeader } from "./PublicSiteHeader";
import type { TextDesign } from "@/lib/design";

/**
 * Renders the fixed marketing header + spacer on every public page
 * EXCEPT the restaurant landing page itself (${slug}), which has its own
 * header via OrgPageView.
 */
export function PublicSiteFrame({
  slug,
  orgName,
  logoUrl,
  accent,
  textColor,
  headerBg,
  headerOpacity,
  headerDesign,
}: {
  slug: string;
  orgName: string;
  logoUrl?: string | null;
  accent: string;
  textColor: string;
  headerBg: string;
  headerOpacity: number;
  headerDesign: TextDesign;
}) {
  const pathname = usePathname();
  // Landing page renders its own header inside OrgPageView.
  if (pathname === `/${slug}` || pathname === `/${slug}/`) return null;
  return (
    <>
      <PublicSiteHeader
        orgName={orgName}
        slug={slug}
        logoUrl={logoUrl}
        accent={accent}
        textColor={textColor}
        headerBg={headerBg}
        headerOpacity={headerOpacity}
        headerDesign={headerDesign}
      />
      <div className="h-16" />
    </>
  );
}