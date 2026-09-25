"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hexToRgba, type DesignSettingsV2, type HeaderElementKind } from "@/lib/design";
import type { OrgView } from "@/components/OrgPageView";

const DEFAULT_ELEMENT_ORDER: HeaderElementKind[] = ["logo", "name", "menu_link", "book_button"];

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

  // Ordered list of element kinds; fall back to default if not configured.
  const orderedKinds: HeaderElementKind[] = h.header_elements?.map((e) => e.kind) ?? DEFAULT_ELEMENT_ORDER;

  // Split into left group (logo, name) and right group (menu_link, book_button)
  // while preserving configured order within each group.
  const leftKinds = orderedKinds.filter((k) => k === "logo" || k === "name");
  const rightKinds = orderedKinds.filter((k) => k === "menu_link" || k === "book_button");

  function renderElement(kind: HeaderElementKind) {
    if (kind === "logo") {
      return org.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key="logo"
          src={org.logo_url}
          alt={`${org.name} logo`}
          className="h-8 w-8 rounded-full object-cover"
          style={{
            border: h.logo_border_width
              ? `${h.logo_border_width}px solid ${h.logo_border_color}`
              : undefined,
          }}
        />
      ) : (
        <span
          key="logo"
          className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold"
          style={{
            backgroundColor: h.cta_design.bgColor,
            color: h.logo_color,
            border: h.logo_border_width
              ? `${h.logo_border_width}px solid ${h.logo_border_color}`
              : undefined,
          }}
        >
          {org.name.charAt(0).toUpperCase()}
        </span>
      );
    }
    if (kind === "name") {
      return (
        <span
          key="name"
          style={{
            fontFamily: h.design.fontFamily,
            fontSize: fS(h.design.fontSize),
            color: h.design.color,
          }}
          className="font-semibold"
        >
          {org.name}
        </span>
      );
    }
    if (kind === "menu_link") {
      return mode === "site" && slug ? (
        <Link
          key="menu_link"
          href={`/${slug}/menu`}
          className="hover:underline"
          style={{ color: h.nav_design.color, fontFamily: h.nav_design.fontFamily, fontSize: fS(h.nav_design.fontSize) }}
        >
          Menu
        </Link>
      ) : (
        <span
          key="menu_link"
          style={{ color: h.nav_design.color, fontFamily: h.nav_design.fontFamily, fontSize: fS(h.nav_design.fontSize) }}
        >
          Menu
        </span>
      );
    }
    if (kind === "book_button") {
      const btnStyle = {
        backgroundColor: h.cta_design.bgColor,
        color: h.cta_design.textColor,
        borderColor: h.cta_design.borderColor,
        borderRadius: h.cta_design.borderRadius,
        borderWidth: h.cta_design.borderWidth,
        fontSize: fS(h.cta_design.fontSize),
        fontFamily: h.cta_design.fontFamily,
        padding: "0.375rem 0.75rem",
      };
      return mode === "site" && slug ? (
        <Link
          key="book_button"
          href={`/${slug}/reserve`}
          className="font-medium border-2 hover:opacity-90 transition-opacity"
          style={btnStyle}
        >
          Book a table
        </Link>
      ) : (
        <span key="book_button" className="font-medium border-2" style={btnStyle}>
          Book a table
        </span>
      );
    }
    return null;
  }

  return (
    <>
      {settings.custom_fonts && settings.custom_fonts.length > 0 && (
        <style dangerouslySetInnerHTML={{
          __html: settings.custom_fonts.map((f) => `@import url('${f.url}');`).join('\n')
        }} />
      )}
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
            {leftKinds.map((k) => renderElement(k))}
          </div>
          <nav className="hidden sm:flex items-center gap-4">
            {rightKinds.map((k) => renderElement(k))}
          </nav>
        </div>
      </div>
    </header>
    </>
  );
}
