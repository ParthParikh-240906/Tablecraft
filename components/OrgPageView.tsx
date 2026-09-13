"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  GOOGLE_FONTS_CSS,
  type ContentElement,
  type DesignSettingsV2,
  type HeroBackground,
  type HeroElement,
  type ShapeStyle,
} from "@/lib/design";
import { FitText } from "./fit-text";
import { AutoBackgroundCarousel } from "./AutoBackgroundCarousel";
import { RestaurantPhotoCarousel } from "./RestaurantPhotoCarousel";
import { SiteHeader } from "./SiteHeader";

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

function ShapeVisual({ s, image }: { s: ShapeStyle; image: boolean }) {
  const borderStyle: React.CSSProperties = s.borderWidth
    ? { borderWidth: s.borderWidth, borderColor: s.borderColor ?? "#ffffff", borderStyle: "solid" as const }
    : {};
  const content =
    image
      ? s.image_url
        ? <img src={s.image_url} alt="" className="w-full h-full object-cover" draggable={false} />
        : null
      : s.color
        ? <div className="w-full h-full" style={{ backgroundColor: s.color }} />
        : null;
  return (
    <div
      className="w-full h-full"
      style={{
        ...borderStyle,
        borderRadius: s.borderRadius ? `${s.borderRadius}%` : undefined,
        overflow: "hidden",
        opacity: (s.opacity ?? 100) / 100,
      }}
    >
      {content}
    </div>
  );
}

function BackgroundVisual({ bg }: { bg: HeroBackground }) {
  const mediaBorder: React.CSSProperties = bg.border_width
    ? { border: `${bg.border_width}px solid ${bg.border_color ?? "#000000"}`, boxSizing: "border-box" as const }
    : {};
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
        style={mediaBorder}
        className={`w-full h-full ${bg.aspectRatio ? "object-cover" : "object-contain"}`}
      />
    ) : null;
  }
  if (bg.type === "images") {
    return bg.image_urls && bg.image_urls.length > 0 ? (
      <div className="w-full h-full" style={mediaBorder}>
        <AutoBackgroundCarousel urls={bg.image_urls} intervalMs={bg.intervalMs || 4000} />
      </div>
    ) : null;
  }
  return bg.video_url ? (
    <video src={bg.video_url} muted autoPlay loop playsInline style={mediaBorder} className="w-full h-full object-cover" />
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

function ButtonVisual({
  el,
  slug,
  mode,
}: {
  el: { buttonType?: "book" | "menu"; bgColor?: string; design: { fontFamily: string; fontSize: number; color: string; textAlign: string } };
  slug?: string;
  mode: "preview" | "site";
}) {
  const label = el.buttonType === "menu" ? "Menu" : "Book a table";
  const href = el.buttonType === "menu" ? `/${slug}/menu` : `/${slug}/reserve`;
  const style: React.CSSProperties = {
    backgroundColor: el.bgColor ?? "#f97316",
    color: el.design.color,
    fontFamily: el.design.fontFamily,
    fontSize: fS(el.design.fontSize),
    textAlign: el.design.textAlign as React.CSSProperties["textAlign"],
    display: "flex",
    alignItems: "center",
    justifyContent: el.design.textAlign === "center" ? "center" : el.design.textAlign === "right" ? "flex-end" : "flex-start",
    width: "100%",
    height: "100%",
    borderRadius: "9999px",
    padding: "0 1rem",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  };

  if (mode === "site" && slug) {
    return (
      <Link href={href} className="w-full h-full block" style={style}>
        {label}
      </Link>
    );
  }
  return <div className="w-full h-full" style={style}>{label}</div>;
}

function ContentVisual({
  el,
  org,
  paragraphs,
  mode,
  slug,
}: {
  el: ContentElement;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  mode: "preview" | "site";
  slug?: string;
}) {
  const s = el.design;

  if (el.kind === "shape") {
    return <ShapeVisual s={el} image={false} />;
  }

  if (el.kind === "button") {
    return <ButtonVisual el={el} slug={slug} mode={mode} />;
  }

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
    const mediaBorder: React.CSSProperties = el.borderWidth
      ? { border: `${el.borderWidth}px solid ${el.borderColor ?? "#000000"}`, boxSizing: "border-box" as const }
      : {};
    return (
      <div className="w-full h-full" style={mediaBorder}>
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
  const contentEls = settings.content.elements;
  const heroBg = hero.background;

  // Effective hero band height in px at the current container width.
  const heroPx =
    heroBg.type === "image" && heroBg.aspectRatio && heroBg.aspectRatio > 0
      ? cw / heroBg.aspectRatio
      : cw * heroRect.h * 0.008;
  const contentMax = Math.max(...contentEls.map((e) => e.y + e.h), 100 - heroRect.h, 40);

  const heroHeight =
    heroBg.type === "image" && heroBg.aspectRatio && heroBg.aspectRatio > 0
      ? `calc(100cqw / ${heroBg.aspectRatio})`
      : cvH(heroRect.h);

  return (
    <div
      ref={ref}
      className="relative"
      style={{
        containerType: "inline-size",
        backgroundColor: colors.bg,
        color: colors.text,
        // In preview the canvas is a fixed-height coordinate space; content
        // blocks are anchored to the design canvas (cvH units), so extending
        // the preview only adds scroll room below — nothing stretches.
        ...(previewHeight && mode === "preview" ? { height: `${previewHeight}px` } : {}),
      }}
    >
      {/* Header — sticky, with page-text-colored bottom border */}
      <SiteHeader org={org} settings={settings} colors={colors} slug={slug} mode={mode} />

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
            el.kind === "shape" || el.kind === "image" ? (
              <div
                key={el.id}
                className="absolute"
                style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, zIndex: 6 }}
              >
                <ShapeVisual s={el} image={el.kind === "image"} />
              </div>
            ) : el.kind === "button" ? (
              <div
                key={el.id}
                className="absolute"
                style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, zIndex: 6 }}
              >
                <ButtonVisual el={el} slug={slug} mode={mode} />
              </div>
            ) : el.kind === "logo" ? (
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

      {/* Content section — height = content extent + ~2 lines of breathing
          room so the last line never sits flush against the section edge. */}
      {contentEls.length > 0 && (
        <section
          className="relative w-full"
          style={{ height: cvH(contentMax + 10), minHeight: 280, zIndex: 5 }}
        >
          {contentEls.map((el) => (
            <div
              key={el.id}
              className="absolute"
              style={{
                left: `${el.x}%`,
                top: cvH(el.y),
                width: `${el.w}%`,
                height: cvH(el.h),
                zIndex: 6,
              }}
            >
              <ContentVisual
                el={el}
                org={org}
                paragraphs={paragraphs}
                mode={mode}
                slug={slug}
              />
            </div>
          ))}
          {/* Console overlay slot: drag/resize boxes. Fixed to the design
              canvas height (cvH(100)) so box coordinates are design units. */}
          {mode === "preview" && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{ top: 0, left: 0, width: "100%", height: cvH(100) }}
              data-panel-overlays="content"
            />
          )}
        </section>
      )}
    </div>
  );
}

export { GOOGLE_FONTS_CSS };