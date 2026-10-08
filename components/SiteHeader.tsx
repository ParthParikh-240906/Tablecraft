"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { deviceForWidth, hexToRgba, resolveColor, resolveFontSize, resolveLogoSize, type DesignSettingsV2, type DeviceKind, type HeaderElementKind } from "@/lib/design";
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
  device: deviceProp,
}: {
  org: OrgView;
  settings: DesignSettingsV2;
  colors: { bg: string; text: string; accent: string };
  slug?: string;
  mode: "preview" | "site";
  /**
   * Explicit device for per-device font resolution. Console previews pass
   * their device toggle (menu/reserve previews are 1:1 but wide, so measuring
   * would misclassify); standalone public renders omit it and measure.
   */
  device?: DeviceKind;
}) {
  const h = settings.header;
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  // Own container width (default 1280 = desktop) so per-device overrides
  // resolve identically whether the header renders inside OrgPageView or
  // standalone (menu/reserve pages).
  const [cw, setCw] = useState(1280);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCw(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const device = deviceProp ?? deviceForWidth(cw || 1280);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Container-relative font sizing (same as OrgPageView): scales with the
  // container up to the 800px design canvas, then caps at authored px so the
  // live site never balloons. The header sets its own inline-size container
  // so cqw resolves identically whether it's rendered inside OrgPageView
  // (landing page) or standalone (menu/reserve pages).
  const fS = (px: number) => `min(calc(${(px / 8).toFixed(5)} * 1cqw), ${px}px)`;
  // Per-device override resolver for header keys, then the usual cap via fS.
  const fs = (px: number, key: string) =>
    fS(resolveFontSize(px, key, device, settings.responsive));

  // Ordered list of element kinds; fall back to default if not configured.
  const orderedKinds: HeaderElementKind[] = h.header_elements?.map((e) => e.kind) ?? DEFAULT_ELEMENT_ORDER;

  // Split into left group (logo, name) and right group (menu_link, book_button)
  // while preserving configured order within each group.
  const leftKinds = orderedKinds.filter((k) => k === "logo" || k === "name");
  const rightKinds = orderedKinds.filter((k) => k === "menu_link" || k === "book_button");

  function renderElement(kind: HeaderElementKind) {
    if (kind === "logo") {
      // Shared desktop base until this device stores its own override.
      const logoSize = resolveLogoSize(h.logo_size ?? 32, device, settings.responsive);
      return org.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key="logo"
          src={org.logo_url}
          alt={`${org.name} logo`}
          className="rounded-full object-cover"
          style={{
            width: logoSize,
            height: logoSize,
            border: h.logo_border_width
              ? `${h.logo_border_width}px solid ${h.logo_border_color}`
              : undefined,
          }}
        />
      ) : (
        <span
          key="logo"
          className="rounded-full flex items-center justify-center font-bold"
          style={{
            width: logoSize,
            height: logoSize,
            fontSize: Math.round((logoSize * 14) / 32),
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
            fontSize: fs(h.design.fontSize, "header.brand"),
            color: resolveColor(h.design.color, "header.brand", device, settings.responsive),
          }}
          className="font-semibold"
        >
          {org.name}
        </span>
      );
    }
    if (kind === "menu_link") {
      const navColor = resolveColor(h.nav_design.color, "header.nav", device, settings.responsive);
      return mode === "site" && slug ? (
        <Link
          key="menu_link"
          href={`/${slug}/menu`}
          className="hover:underline"
          style={{ color: navColor, fontFamily: h.nav_design.fontFamily, fontSize: fs(h.nav_design.fontSize, "header.nav") }}
        >
          Menu
        </Link>
      ) : (
        <span
          key="menu_link"
          style={{ color: navColor, fontFamily: h.nav_design.fontFamily, fontSize: fs(h.nav_design.fontSize, "header.nav") }}
        >
          Menu
        </span>
      );
    }
    if (kind === "book_button") {
      // Padding is em-based so the CTA text-size control visibly resizes the
      // whole button (fixed px/cqw padding + a min-height floor used to make
      // the button look unchanged when only the font size was lowered).
      const btnStyle = {
        backgroundColor: hexToRgba(h.cta_design.bgColor, (h.cta_design.opacity ?? 100) / 100),
        color: resolveColor(h.cta_design.textColor, "header.cta", device, settings.responsive),
        borderColor: h.cta_design.borderColor,
        borderRadius: h.cta_design.borderRadius,
        borderWidth: h.cta_design.borderWidth,
        fontSize: fs(h.cta_design.fontSize, "header.cta"),
        fontFamily: h.cta_design.fontFamily,
        padding: "0.55em 1.1em",
        whiteSpace: "nowrap" as const,
        lineHeight: 1.2,
      };
      return mode === "site" && slug ? (
        <Link
          key="book_button"
          href={`/${slug}/reserve`}
          className="font-medium border-2 hover:opacity-90 transition-opacity inline-flex items-center"
          style={btnStyle}
        >
          Book a table
        </Link>
      ) : (
        <span key="book_button" className="font-medium border-2 inline-flex items-center" style={btnStyle}>
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
          // Self-hosted entries carry rewritten @font-face CSS (no Google
          // contact, no visitor IP leak). Legacy Google-URL entries fall back
          // to @import until they are migrated via the AI panel.
          __html: settings.custom_fonts.map((f) => f.css ?? `@import url('${f.url}');`).join('\n')
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {leftKinds.map((k) => renderElement(k))}
          </div>
          <nav className="flex items-center gap-4 flex-wrap" aria-label="Restaurant">
            {rightKinds.map((k) => renderElement(k))}
          </nav>
        </div>
      </div>
    </header>
    </>
  );
}
