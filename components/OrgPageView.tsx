"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  GOOGLE_FONTS_CSS,
  hexToRgba,
  type ContentElement,
  type DesignSettingsV2,
  type HeroBackground,
  type HeroElement,
  type Layer,
} from "@/lib/design";
import { FitText } from "./fit-text";
import { AutoBackgroundCarousel } from "./AutoBackgroundCarousel";
import { RestaurantPhotoCarousel } from "./RestaurantPhotoCarousel";

export interface OrgView {
  name: string;
  tagline: string | null;
  logo_url: string | null;
  about_title: string | null;
  about_text: string | null;
  contact_heading: string | null;
  location: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  restaurant_photos: string[] | null;
}

const capitalizeWords = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

// Design canvas is 800w x 640h: heights are `pct * 0.8` cqw (= % world width at
// 800px), fonts are `px / 8` cqw. Container units make every size proportional
// to the container, so the preview (narrow) and the site (wide) look identical.
const cvH = (pct: number) => `calc(${((pct * 0.8) / 100).toFixed(5)} * 100cqw)`;
const fS = (px: number) => `calc(${(px / 8).toFixed(5)} * 1cqw)`;

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

function LayerVisual({ l }: { l: Layer }) {
  const borderStyle: React.CSSProperties = l.borderWidth
    ? { borderWidth: l.borderWidth, borderColor: l.borderColor ?? "#ffffff", borderStyle: "solid" as const }
    : {};
  const content = l.type === "image"
    ? (l.image_url
        ? <img src={l.image_url} alt="" className="w-full h-full object-cover" draggable={false} />
        : null)
    : l.type === "images"
      ? (l.image_urls && l.image_urls.length > 0 ? <AutoBackgroundCarousel urls={l.image_urls} intervalMs={4000} /> : null)
      : l.type === "video"
        ? (l.video_url
            ? <video src={l.video_url} muted autoPlay loop playsInline className="w-full h-full object-cover" />
            : null)
        : <div className="w-full h-full" style={{ backgroundColor: l.color }} />;
  return (
    <div
      className="w-full h-full"
      style={{
        ...borderStyle,
        borderRadius: l.borderRadius ? `${l.borderRadius}px` : undefined,
        overflow: "hidden",
      }}
    >
      {content}
    </div>
  );
}

function BackgroundVisual({ bg }: { bg: HeroBackground }) {
  if (bg.type === "color") {
    return <div className="w-full h-full" style={{ backgroundColor: bg.color }} />;
  }
  if (bg.type === "image") {
    return bg.image_url ? (
      // With a stored aspect ratio the band matches the image (no crop);
      // without one, contain keeps the whole image visible instead of cropping.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={bg.image_url}
        alt=""
        draggable={false}
        className={`w-full h-full ${bg.aspectRatio ? "object-cover" : "object-contain"}`}
      />
    ) : null;
  }
  if (bg.type === "images") {
    return bg.image_urls && bg.image_urls.length > 0 ? (
      <AutoBackgroundCarousel urls={bg.image_urls} intervalMs={bg.intervalMs || 4000} />
    ) : null;
  }
  return bg.video_url ? (
    <video src={bg.video_url} muted autoPlay loop playsInline className="w-full h-full object-cover" />
  ) : null;
}

function HeroText({
  el,
  orgName,
  tagline,
  heroPx,
  onGrow,
}: {
  el: HeroElement;
  orgName: string;
  tagline: string | null;
  heroPx: number;
  onGrow?: (id: string, h: number) => void;
}) {
  const s = el.design;
  if (el.kind === "logo") return null; // rendered separately
  const text =
    el.kind === "title" ? capitalizeWords(orgName) : el.kind === "tagline" ? tagline : el.content;
  if (!text) return null;
  return (
    <FitText
      bandPx={heroPx}
      onGrow={onGrow ? (h) => onGrow(el.id, h) : undefined}
      fontSize={s.fontSize}
      fontFamily={s.fontFamily}
      text={text}
      widthPct={el.w}
      className="w-full h-full overflow-hidden leading-tight"
      style={{
        fontFamily: s.fontFamily,
        fontSize: fS(s.fontSize),
        color: s.color,
        textAlign: s.textAlign,
      }}
    >
      <span className="whitespace-pre-line">{text}</span>
    </FitText>
  );
}

function ContentVisual({
  el,
  org,
  paragraphs,
  mode,
}: {
  el: ContentElement;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  mode: "preview" | "site";
}) {
  const s = el.design;

  if (el.kind === "image" || el.kind === "images") {
    const urls =
      el.ref && "org" in el.ref && el.ref.org === "restaurant_photos"
        ? org.restaurant_photos ?? []
        : el.image_urls ?? [];
    if (mode === "preview") {
      // Requirement: preview shows a blank rectangle — the website shows images.
      return (
        <div className="w-full h-full border-2 border-dashed border-[var(--ink-faint)]/60 bg-[var(--rule)] flex flex-col items-center justify-center gap-1 overflow-hidden">
          <span className="text-xl">🖼</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">
            {urls.length > 0 ? `${urls.length} image${urls.length > 1 ? "s" : ""}` : el.kind === "images" ? "Image carousel" : "Image"}
          </span>
          <span className="text-[10px] text-[var(--ink-faint)]">Shown on website</span>
        </div>
      );
    }
    if (urls.length === 0) return null;
    return (
      <div className="w-full h-full">
        {el.kind === "images" ? (
          <RestaurantPhotoCarousel
            photos={urls}
            name={org.name}
            accent="#f97316"
            intervalMs={4000}
            showArrows={false}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[0]} alt="" className="w-full h-full object-cover rounded-2xl shadow-2xl" />
        )}
      </div>
    );
  }

  let text: string = el.content ?? "";
  if (el.ref && "org" in el.ref) {
    const key = el.ref.org;
    const contactBody = [org.contact_phone, org.contact_email, org.contact_address]
      .filter(Boolean)
      .map((x) => `• ${x}`)
      .join("\n");
    const map: Record<string, string | null> = {
      about_title: org.about_title,
      about_text: org.about_text,
      contact_heading: org.contact_heading,
      location: org.location,
      contact_body: contactBody || null,
    };
    text = map[key] ?? "";
  } else if (el.ref && typeof (el.ref as Record<string, unknown>).para === "string") {
    const p = paragraphs.find((x) => x.id === (el.ref as { para: string }).para);
    if (p) text = el.kind === "title" ? p.title ?? "" : p.content ?? "";
  }
  if (!text) return null;

  return (
    <div
      className={`w-full h-full overflow-hidden leading-relaxed ${el.kind === "title" ? "font-bold" : ""}`}
      style={{ fontFamily: s.fontFamily, fontSize: fS(s.fontSize), color: s.color, textAlign: s.textAlign }}
    >
      <span className="whitespace-pre-line">{text}</span>
    </div>
  );
}

function SiteHeader({
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

  return (
    <header ref={ref} className="sticky top-0 z-[70]">
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
                  href={`/${slug}/cart`}
                  className="hover:underline"
                  style={{ color: h.nav_design.color, fontFamily: h.nav_design.fontFamily, fontSize: fS(h.nav_design.fontSize) }}
                >
                  Cart
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
                  style={{ color: h.nav_design.color, fontFamily: h.nav_design.fontFamily, fontSize: fS(h.nav_design.fontSize) }}
                >
                  Cart
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

/**
 * The full restaurant landing page: header, decorative layers, hero section
 * (background + positioned elements) and content section. Rendered identically
 * in the console preview (mode="preview", narrow container) and on the public
 * site (mode="site"), where every size scales with the container via cqw.
 */
export function OrgPageView({
  org,
  settings,
  paragraphs,
  colors,
  mode,
  slug,
  onGrowHero,
  previewHeight,
}: {
  org: OrgView;
  settings: DesignSettingsV2;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  colors: { bg: string; text: string; accent: string };
  mode: "preview" | "site";
  slug?: string;
  onGrowHero?: (id: string, h: number) => void;
  previewHeight?: number;
}) {
  const { ref, width: cw } = useContainerWidth();
  const hero = settings.hero;
  const heroRect = settings.canvas.hero_rect;
  const layers = settings.canvas.layers;
  const contentEls = settings.content.elements;
  const heroBg = hero.background;

  // Effective hero band height in px at the current container width.
  const heroPx =
    heroBg.type === "image" && heroBg.aspectRatio && heroBg.aspectRatio > 0
      ? cw / heroBg.aspectRatio
      : cw * heroRect.h * 0.008;
  const contentMax = Math.max(...contentEls.map((e) => e.y + e.h), 100 - heroRect.h, 40);

  // In preview mode with an extended canvas, size the content section to fill
  // the remaining visible area (previewHeight - heroHeight). This makes the
  // preview match the live site proportionally. Fall back to percentage-based
  // sizing when no explicit previewHeight is given (live site, no extend).
  const contentSectionHeight =
    mode === "preview" && previewHeight && previewHeight > heroPx
      ? fS(previewHeight - heroPx)
      : undefined;

  const heroHeight =
    heroBg.type === "image" && heroBg.aspectRatio && heroBg.aspectRatio > 0
      ? `calc(100cqw / ${heroBg.aspectRatio})`
      : cvH(heroRect.h);

  return (
    <div
      ref={ref}
      className="relative"
      style={{ containerType: "inline-size", backgroundColor: colors.bg, color: colors.text }}
    >
      {/* Header — sticky, with page-text-colored bottom border */}
      <SiteHeader org={org} settings={settings} colors={colors} slug={slug} mode={mode} />

      {/* Layers — decorative rectangles behind the hero/content */}
      {(() => {
        const isPreview = mode === "preview";
        return layers
          .slice()
          .sort((a, b) => a.z - b.z)
          .map((l) => (
            <div
              key={l.id}
              className="absolute overflow-hidden pointer-events-none"
              style={{
                left: `${l.x}%`,
                top: cvH(l.y),
                width: `${l.w}%`,
                height: cvH(l.h),
                zIndex: l.z,
                opacity: (l.opacity ?? 100) / 100,
              }}
            >
              <LayerVisual l={l} />
            </div>
          ));
      })()}

      {/* Hero section */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: heroHeight, minHeight: 300, zIndex: 5 }}
      >
        <div className="absolute inset-0" style={{ opacity: (heroBg.opacity ?? 100) / 100 }}>
          <BackgroundVisual bg={heroBg} />
        </div>
        {/* Console overlay slot: hero band rect (height for the hero section) */}
        {mode === "preview" && (
          <div className="absolute inset-0 z-20 pointer-events-none" data-panel-overlays="hero-band" />
        )}
        <div className="absolute inset-0">
          {hero.elements.map((el) =>
            el.kind === "logo" ? (
              org.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={el.id}
                  src={org.logo_url}
                  alt={`${org.name} logo`}
                  className="absolute object-cover rounded-full shadow-lg"
                  style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, zIndex: 6 }}
                  draggable={false}
                />
              ) : (
                <div
                  key={el.id}
                  className="absolute rounded-full flex items-center justify-center text-3xl font-bold shadow-lg"
                  style={{
                    left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, zIndex: 6,
                    backgroundColor: colors.accent, color: colors.text,
                  }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div
                key={el.id}
                className="absolute"
                style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, zIndex: 6 }}
              >
                <HeroText
                  el={el}
                  orgName={org.name}
                  tagline={org.tagline}
                  heroPx={heroPx}
                  onGrow={onGrowHero}
                />
              </div>
            ),
          )}
        </div>
        {/* Console overlay slot: hero element drag/resize boxes */}
        {mode === "preview" && (
          <div className="absolute inset-0 z-30 pointer-events-none" data-panel-overlays="hero" />
        )}
      </section>

      {/* Content section */}
      {contentEls.length > 0 && (
        <section
          className="relative w-full"
          style={{ height: contentSectionHeight ?? cvH(contentMax), minHeight: 280, zIndex: 5 }}
        >
          {contentEls.map((el) => (
            <div
              key={el.id}
              className="absolute"
              style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, zIndex: 6 }}
            >
              <ContentVisual
                el={el}
                org={org}
                paragraphs={paragraphs}
                mode={mode}
              />
            </div>
          ))}
          {/* Console overlay slot: content element drag/resize boxes */}
          {mode === "preview" && (
            <div className="absolute inset-0 z-30 pointer-events-none" data-panel-overlays="content" />
          )}
        </section>
      )}

      {/* Console overlay slot: layer drag/resize boxes (whole page) */}
      {mode === "preview" && (
        <div
          className="absolute inset-0 z-40 pointer-events-none"
          data-panel-overlays="layers"
        />
      )}
    </div>
  );
}

export { GOOGLE_FONTS_CSS };