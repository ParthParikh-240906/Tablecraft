"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hexToRgba, type DesignSettingsV2 } from "@/lib/design";
import type { OrgView } from "@/components/OrgPageView";

/**
 * Shared sticky header used on the restaurant landing page, menu page, and
 * reserve page. Uses the design settings (header bg, opacity, nav_design,
 * cta_design) so all pages look identical.
 */
export function SiteHeader({
  org,
  settings,
  colors,
  slug,
  mode,
}: {
  org: OrgView;
  settings: DesignSettingsV2;
  colors: { bg: string; text: string; accent: string };
  slug?: string;
  mode: "preview" | "site";
}) {
  const h = settings.header;
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Container-relative font sizing (same as OrgPageView). The header sets its
  // own inline-size container so cqw resolves identically whether it's rendered
  // inside OrgPageView (landing page) or standalone (menu/reserve pages).
  const fS = (px: number) => `calc(${(px / 8).toFixed(5)} * 1cqw)`;

  return (
    <header
      ref={ref}
      className="sticky top-0 z-[70]"
      style={{ containerType: "inline-size" }}
    >
      <div
        className="relative z-[60] transition-shadow duration-300"
        style={{
          backgroundColor: hexToRgba(h.background_color, h.opacity / 100),
          backdropFilter: scrolled ? "blur(12px)" : undefined,
          boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.35)" : undefined,
          borderBottom: `2px solid ${colors.text}`,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {org.logo_url ? (
              <img src={org.logo_url} alt={`${org.name} logo`} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span
                className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: h.cta_design.bgColor, color: h.logo_color }}
              >
                {org.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span
              style={{
                fontFamily: h.design.fontFamily,
                fontSize: fS(h.design.fontSize),
                color: h.design.color,
              }}
              className="font-semibold"
            >
              {org.name}
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-4">
            {mode === "site" && slug ? (
              <>
                <Link
                  href={`/${slug}/menu`}
                  className="hover:underline"
                  style={{ color: h.nav_design.color, fontFamily: h.nav_design.fontFamily, fontSize: fS(h.nav_design.fontSize) }}
                >
                  Menu
                </Link>
                <Link
                  href={`/${slug}/reserve`}
                  className="font-medium border-2 hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: h.cta_design.bgColor,
                    color: h.cta_design.textColor,
                    borderColor: h.cta_design.borderColor,
                    borderRadius: h.cta_design.borderRadius,
                    borderWidth: h.cta_design.borderWidth,
                    fontSize: fS(h.cta_design.fontSize),
                    fontFamily: h.cta_design.fontFamily,
                    padding: "0.375rem 0.75rem",
                  }}
                >
                  Book a table
                </Link>
              </>
            ) : (
              <>
                <span
                  style={{ color: h.nav_design.color, fontFamily: h.nav_design.fontFamily, fontSize: fS(h.nav_design.fontSize) }}
                >
                  Menu
                </span>
                <span
                  className="font-medium border-2"
                  style={{
                    backgroundColor: h.cta_design.bgColor,
                    color: h.cta_design.textColor,
                    borderColor: h.cta_design.borderColor,
                    borderRadius: h.cta_design.borderRadius,
                    borderWidth: h.cta_design.borderWidth,
                    fontSize: fS(h.cta_design.fontSize),
                    fontFamily: h.cta_design.fontFamily,
                    padding: "0.375rem 0.75rem",
                  }}
                >
                  Book a table
                </span>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}