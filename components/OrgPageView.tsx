"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  deviceForWidth,
  interactiveClasses,
  interactiveStyle,
  resolveColor,
  resolveFontSize,
  resolveRect,
  type ContentElement,
  type DesignSettingsV2,
  type DeviceKind,
  type HeroBackground,
  type HeroElement,
  type ResponsiveOverrides,
  type ShapeStyle,
  type TextDesign,
} from "@/lib/design";
import { FitText } from "./fit-text";
import { AutoBackgroundCarousel } from "./AutoBackgroundCarousel";
import { RestaurantPhotoCarousel } from "./RestaurantPhotoCarousel";
import { SiteHeader } from "./SiteHeader";
import { AnimatedText } from "./AnimatedText";
import { getShadowStyle } from "@/lib/design";

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

// Design canvas is 800w x 640h: heights are `pct * 0.8` cqw (= % world width at
// 800px). Fonts scale with the container up to the 800px canvas, then cap at
// their authored px size — so the narrow console preview and the wide live
// site render type at the same absolute size instead of ballooning live.
const cvH = (pct: number) => `calc(${((pct * 0.8) / 100).toFixed(5)} * 100cqw)`;
const fS = (px: number) => `min(calc(${(px / 8).toFixed(5)} * 1cqw), ${px}px)`;

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
  // Default border is black, matching every "Border color" picker default in
  // the console. (A previous white default here disagreed with the pickers:
  // picking black was a no-op change event, so borders were stuck white.)
  const borderStyle: React.CSSProperties = s.borderWidth
    ? { borderWidth: s.borderWidth, borderColor: s.borderColor ?? "#000000", borderStyle: "solid" as const }
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
  let base: React.ReactNode = null;
  if (bg.type === "color") {
    base = <div className="w-full h-full" style={{ backgroundColor: bg.color }} />;
  } else if (bg.type === "image") {
    base = bg.image_url ? (
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
  } else if (bg.type === "images") {
    base = bg.image_urls && bg.image_urls.length > 0 ? (
      <div className="w-full h-full" style={mediaBorder}>
        <AutoBackgroundCarousel urls={bg.image_urls} intervalMs={bg.intervalMs || 4000} />
      </div>
    ) : null;
  } else {
    base = bg.video_url ? (
      <video src={bg.video_url} muted autoPlay loop playsInline style={mediaBorder} className="w-full h-full object-cover" />
    ) : null;
  }
  // Glow + scrim default off (flags absent on old orgs). When on, they sit
  // above the base media but behind hero content (content lives in a sibling
  // layer at zIndex 6).
  if (!bg.glow && !bg.scrim) return <>{base}</>;
  return (
    <div className="w-full h-full relative">
      {base}
      {bg.glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0.08) 40%, transparent 70%)",
            filter: "blur(30px)",
            zIndex: 1,
          }}
        />
      )}
      {bg.scrim && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.65) 100%)",
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}

function HeroText({
  el,
  orgName,
  tagline,
  heroPx,
  onGrow,
  mode,
  device,
  responsive,
}: {
  el: HeroElement;
  orgName: string;
  tagline: string | null;
  heroPx: number;
  onGrow?: (id: string, h: number) => void;
  mode?: "preview" | "site";
  device: DeviceKind;
  responsive?: ResponsiveOverrides | null;
}) {
  const s = el.design;
  if (el.kind === "logo") return null; // rendered separately
  const text =
    el.kind === "title" ? orgName : el.kind === "tagline" ? tagline : el.content;
  if (!text) return null;
  // Per-device override for this hero element (`hero:<id>`), then the usual
  // container cap via fS.
  const resolvedSize = resolveFontSize(s.fontSize, `hero:${el.id}`, device, responsive);
  const resolvedColor = resolveColor(s.color, `hero:${el.id}`, device, responsive);
  // On the live site there is no auto-grow save path, so the box must never
  // hard-clip: it sizes to its content (anchored at its top %) instead of a
  // fixed % height. In preview the fixed height is kept so FitText can measure
  // overflow and grow the saved rect.
  const siteMode = mode === "site";
  return (
    <FitText
      bandPx={heroPx}
      onGrow={onGrow ? (h) => onGrow(el.id, h) : undefined}
      fontSize={resolvedSize}
      fontFamily={s.fontFamily}
      text={text}
      widthPct={el.w}
      className={siteMode ? "w-full leading-tight" : "w-full h-full overflow-hidden leading-tight"}
      style={{
        fontFamily: s.fontFamily,
        fontSize: fS(resolvedSize),
        color: resolvedColor,
        textAlign: s.textAlign,
      }}
    >
      <AnimatedText
        design={s}
        style={{ display: "inline" }}
        preview={mode === "preview"}
        className={s.gradient ? "gradient-text" : undefined}
      >
        <span className="whitespace-pre-line">{text}</span>
      </AnimatedText>
    </FitText>
  );
}

function ButtonVisual({
  el,
  slug,
  mode,
  fontKey,
  device,
  responsive,
}: {
  el: { buttonType?: "book" | "menu"; bgColor?: string; design: TextDesign };
  slug?: string;
  mode: "preview" | "site";
  fontKey?: string;
  device?: DeviceKind;
  responsive?: ResponsiveOverrides | null;
}) {
  const label = el.buttonType === "menu" ? "Menu" : "Book a table";
  const href = el.buttonType === "menu" ? `/${slug}/menu` : `/${slug}/reserve`;
  const resolvedSize = resolveFontSize(el.design.fontSize, fontKey, device ?? "desktop", responsive);
  const resolvedColor = resolveColor(el.design.color, fontKey, device ?? "desktop", responsive);
  const style: React.CSSProperties = {
    backgroundColor: el.bgColor ?? "#f97316",
    color: resolvedColor,
    fontFamily: el.design.fontFamily,
    fontSize: fS(resolvedSize),
    textAlign: el.design.textAlign as React.CSSProperties["textAlign"],
    display: "flex",
    alignItems: "center",
    justifyContent: el.design.textAlign === "center" ? "center" : el.design.textAlign === "right" ? "flex-end" : "flex-start",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    borderRadius: "9999px",
    padding: `0 ${fS(24)}`,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    lineHeight: 1.2,
    ...interactiveStyle(el.design.interactive, true),
  };
  // Buttons reveal on scroll via their own design.animation. When the
  // animation is none/absent no wrapper is added, so the render is byte-
  // identical to before (flex label directly in the pill).
  const animActive = !!el.design.animation && el.design.animation.type !== "none";
  const labelNode = animActive ? <AnimatedText design={el.design} preview={mode === "preview"}>{label}</AnimatedText> : label;

  if (mode === "site" && slug) {
    return (
      <Link href={href} className={`w-full h-full block ${interactiveClasses(el.design.interactive, true)}`} style={style}>
        {labelNode}
      </Link>
    );
  }
  return <div className={`w-full h-full ${interactiveClasses(el.design.interactive, true)}`} style={style}>{labelNode}</div>;
}

function ContentVisual({
  el,
  org,
  paragraphs,
  mode,
  slug,
  device,
  responsive,
}: {
  el: ContentElement;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  mode: "preview" | "site";
  slug?: string;
  device: DeviceKind;
  responsive?: ResponsiveOverrides | null;
}) {
  const s = el.design;

  if (el.kind === "shape") {
    return <ShapeVisual s={el} image={false} />;
  }

  if (el.kind === "button") {
    return <ButtonVisual el={el} slug={slug} mode={mode} fontKey={`content:${el.id}`} device={device} responsive={responsive} />;
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
          <img src={urls[0]} alt="" className="w-full h-full object-cover" />
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
    // Live org text wins; stored element content is the fallback (e.g. the
    // "About Us" heading when no custom title was set).
    text = map[key] || el.content || "";
  } else if (el.ref && typeof (el.ref as Record<string, unknown>).para === "string") {
    const p = paragraphs.find((x) => x.id === (el.ref as { para: string }).para);
    if (p) text = el.kind === "title" ? p.title ?? "" : p.content ?? "";
  }
  if (!text) return null;

  const resolvedColor = resolveColor(s.color, `content:${el.id}`, device, responsive);
  return (
    <AnimatedText
      text={text}
      design={s}
      preview={mode === "preview"}
      className={`w-full h-full overflow-hidden leading-relaxed whitespace-pre-line ${el.kind === "title" ? "font-bold" : ""}${s.gradient ? " gradient-text" : ""}`}
      style={{ fontFamily: s.fontFamily, fontSize: fS(resolveFontSize(s.fontSize, `content:${el.id}`, device, responsive)), color: resolvedColor, textAlign: s.textAlign }}
    />
  );
}

/**
 * The full restaurant landing page: header, decorative layers, hero section
 * (background + positioned elements) and content section. Type sizes cap at
 * their authored px values above the 800px design canvas, so the console
 * preview (narrow) and the public site (wide) render text identically.
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
  device: deviceProp,
}: {
  org: OrgView;
  settings: DesignSettingsV2;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  colors: { bg: string; text: string; accent: string };
  mode: "preview" | "site";
  slug?: string;
  onGrowHero?: (id: string, h: number) => void;
  previewHeight?: number;
  /**
   * Explicit device for per-device font/rect resolution. The console preview
   * passes its device toggle (zoomed measured widths would misclassify);
   * the live site omits it so the real container width decides.
   */
  device?: DeviceKind;
}) {
  const { ref, width: cw } = useContainerWidth();
  const hero = settings.hero;
  const heroRect = settings.canvas.hero_rect;
  const contentEls = settings.content.elements;
  const heroBg = hero.background;
  // Per-device overrides key off the console toggle in preview (same
  // breakpoints as the viewport hook; default 1280 = desktop while
  // measuring). On the live site the measured container width decides.
  const device = deviceProp ?? deviceForWidth(cw || 1280);
  const responsive = settings.responsive;
  // Element rects resolve per-device too: shared base until the user edits
  // on tablet/mobile, which stores a `rects[key]` override. Overlay boxes
  // and rendered content use the same resolver, so they can't diverge.
  const heroRectOf = (el: HeroElement) => resolveRect(el, `hero:${el.id}`, device, responsive);
  const contentRectOf = (el: ContentElement) => resolveRect(el, `content:${el.id}`, device, responsive);

  // Effective hero band height in px at the current container width.
  const heroPx =
    heroBg.type === "image" && heroBg.aspectRatio && heroBg.aspectRatio > 0
      ? cw / heroBg.aspectRatio
      : cw * heroRect.h * 0.008;
  const contentMax = Math.max(...contentEls.map((e) => e.y + e.h), 100 - heroRect.h, 40);
  const previewCanvasUnits = previewHeight ? (previewHeight / 640) * 100 : 100;
  const sectionHeightUnits = Math.max(contentMax + 10, mode === "preview" ? previewCanvasUnits : 0, 100);

  const heroHeight =
    heroBg.type === "image" && heroBg.aspectRatio && heroBg.aspectRatio > 0
      ? `calc(100cqw / ${heroBg.aspectRatio})`
      : cvH(heroRect.h);

  return (
    <div style={{ backgroundColor: colors.bg, color: colors.text }}>
      <div
        ref={ref}
        className="relative mx-auto w-full"
        style={{
          containerType: "inline-size",
          maxWidth: 1280,
        }}
      >
      {/* Header — sticky, with page-text-colored bottom border */}
      <SiteHeader org={org} settings={settings} colors={colors} slug={slug} mode={mode} device={device} />

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
          {hero.elements.map((el) => {
            // Device-resolved rect (base desktop values until a tablet/mobile
            // override is stored) — identical resolver to the console overlay.
            const r = heroRectOf(el);
            return el.kind === "shape" || el.kind === "image" ? (
              <div
                key={el.id}
                className={`absolute ${interactiveClasses(el.design.interactive, false)}`}
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, zIndex: 6, ...interactiveStyle(el.design.interactive, false) }}
              >
                <ShapeVisual s={el} image={el.kind === "image"} />
              </div>
            ) : el.kind === "button" ? (
              <div
                key={el.id}
                className="absolute"
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, zIndex: 6 }}
              >
                <ButtonVisual el={el} slug={slug} mode={mode} fontKey={`hero:${el.id}`} device={device} responsive={responsive} />
              </div>
            ) : el.kind === "logo" ? (
              org.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={el.id}
                  src={org.logo_url}
                  alt={`${org.name} logo`}
                  className="absolute object-cover rounded-full shadow-lg"
                  style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, zIndex: 6 }}
                  draggable={false}
                />
              ) : (
                <div
                  key={el.id}
                  className="absolute rounded-full flex items-center justify-center text-3xl font-bold shadow-lg"
                  style={{
                    left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, zIndex: 6,
                    backgroundColor: colors.accent, color: colors.text,
                  }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div
                key={el.id}
                className={`absolute ${interactiveClasses(el.design.interactive, false)}`}
                style={
                  mode === "site"
                    ? { left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, minHeight: `${r.h}%`, zIndex: 6, ...interactiveStyle(el.design.interactive, false) }
                    : { left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, zIndex: 6, ...interactiveStyle(el.design.interactive, false) }
                }
              >
                <HeroText
                  el={{ ...el, x: r.x, y: r.y, w: r.w, h: r.h }}
                  orgName={org.name}
                  tagline={org.tagline}
                  heroPx={heroPx}
                  onGrow={onGrowHero}
                  mode={mode}
                  device={device}
                  responsive={responsive}
                />
              </div>
            );
          })}
        </div>
        {/* Console overlay slot: hero element drag/resize boxes */}
        {mode === "preview" && (
          <div className="absolute inset-0 z-30 pointer-events-none" data-panel-overlays="hero" />
        )}
      </section>

      {/* Content section — height = content extent + extended preview room */}
      {contentEls.length > 0 && (
        <section
          className="relative w-full"
          style={{ height: cvH(sectionHeightUnits), minHeight: 280, zIndex: 5 }}
        >
          {contentEls.map((el) => {
            const r = contentRectOf(el);
            // Buttons resolve their own hover inside ButtonVisual (default
            // on); every other kind resolves here (default off).
            const wrapInteractive = el.kind === "button" ? "" : interactiveClasses(el.design.interactive, false);
            const wrapStyle = el.kind === "button" ? {} : interactiveStyle(el.design.interactive, false);
            return (
              <div
                key={el.id}
                className={`absolute ${wrapInteractive}`}
                style={{
                  left: `${r.x}%`,
                  top: cvH(r.y),
                  width: `${r.w}%`,
                  height: cvH(r.h),
                  zIndex: 6,
                  ...wrapStyle,
                }}
              >
                <ContentVisual
                  el={el}
                  org={org}
                  paragraphs={paragraphs}
                  mode={mode}
                  slug={slug}
                  device={device}
                  responsive={responsive}
                />
              </div>
            );
          })}
          {/* Console overlay slot: drag/resize boxes spanning full section */}
          {mode === "preview" && (
            <div
              className="absolute inset-0 z-30 pointer-events-none"
              data-panel-overlays="content"
            />
          )}
        </section>
      )}
      </div>
    </div>
  );
}

