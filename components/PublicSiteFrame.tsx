"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "./SiteHeader";
import type { DesignSettingsV2 } from "@/lib/design";
import type { OrgView } from "@/components/OrgPageView";

/**
 * Renders the shared sticky header + spacer on every public page
 * EXCEPT the restaurant landing page itself (${slug}), which has its own
 * header via OrgPageView.
 */
export function PublicSiteFrame({
  slug,
  basePath,
  org,
  settings,
  colors,
}: {
  slug: string;
  basePath: string;
  org: OrgView;
  settings: DesignSettingsV2;
  colors: { bg: string; text: string; accent: string };
}) {
  const pathname = usePathname();
  // Landing page renders its own header inside OrgPageView. On a custom domain
  // the landing URL is "/" while on the platform it is "/<slug>".
  if (
    pathname === "/" ||
    pathname === basePath ||
    pathname === `${basePath}/` ||
    pathname === `/${slug}` ||
    pathname === `/${slug}/`
  ) {
    return null;
  }
  return (
    <>
      <SiteHeader
        org={org}
        settings={settings}
        colors={colors}
        slug={slug}
        basePath={basePath}
        mode="site"
      />
      <div className="h-16" />
    </>
  );
}