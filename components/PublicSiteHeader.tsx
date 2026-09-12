"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hexToRgba } from "@/lib/design";
import type { TextDesign } from "@/lib/design";

/**
 * Fixed site header with the marketing-page behavior: transparent at the
 * very top of the page, then background at the configured opacity + blur
 * once the user scrolls past 20 px.
 */
export function PublicSiteHeader({
  orgName,
  slug,
  logoUrl,
  accent,
  textColor,
  headerBg,
  headerOpacity,
  headerDesign,
}: {
  orgName: string;
  slug: string;
  logoUrl?: string | null;
  accent: string;
  textColor: string;
  headerBg: string;
  headerOpacity: number;
  headerDesign: TextDesign;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const bg = scrolled ? hexToRgba(headerBg, headerOpacity / 100) : "transparent";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: bg,
        backdropFilter: scrolled ? "blur(12px)" : undefined,
        borderBottom: `2px solid ${textColor}`,
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.35)" : undefined,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={`/${slug}`} className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${orgName} logo`} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span
              className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: accent, color: textColor }}
            >
              {orgName.charAt(0).toUpperCase()}
            </span>
          )}
          <span
            style={{
              fontFamily: headerDesign.fontFamily,
              fontSize: headerDesign.fontSize,
              color: headerDesign.color,
              textAlign: headerDesign.textAlign,
            }}
          >
            {orgName}
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm" style={{ color: textColor }}>
          <Link href={`/${slug}/menu`} className="hover:underline">
            Menu
          </Link>
          <Link href={`/${slug}/cart`} className="hover:underline">
            Cart
          </Link>
          <Link
            href={`/${slug}/reserve`}
            className="px-3 py-1.5 rounded-full text-sm font-medium border-2"
            style={{ backgroundColor: accent, color: textColor, borderColor: accent }}
          >
            Book a table
          </Link>
        </nav>
      </div>
    </header>
  );
}