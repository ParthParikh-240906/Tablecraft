"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { type DesignSettingsV2, type DeviceKind } from "@/lib/design";
import { withBuiltSiteGuards, withLiveGallery, withLiveHero, withLiveHeroMobile, withLiveMenu, withPreviewChrome, type LiveMenuItem } from "@/lib/built-site";
import { OrgPageView, type OrgView } from "@/components/OrgPageView";
import { useDesignDevice } from "./design-device";

// Fixed design widths (px). The frame always renders at the device's design
// width and is zoomed down to fit the pane — so the preview is a true
// miniature of that viewport instead of a reflowed narrow layout. Desktop
// 1280 matches the live site's capped content width (see OrgPageView).
const DEVICES: {
  id: DeviceKind;
  label: string;
  width: number;
  hint: string;
}[] = [
  { id: "desktop", label: "Desktop", width: 1280, hint: "1280px" },
  { id: "tablet", label: "Tablet", width: 768, hint: "768px" },
  { id: "mobile", label: "Mobile", width: 390, hint: "390px" },
];

/**
 * Full-page scroll preview frame shared by all design subpages.
 * Renders the actual page via OrgPageView (identical to the public site) plus
 * the panel's interactive overlay boxes (children).
 *
 * The inner frame always renders at the selected device's fixed design width
 * (desktop 1280 = the live site's capped width) and is zoomed to fit the
 * pane — a true miniature of that viewport. Drag/resize math is ratio-based
 * (% of rects measured in the same zoomed space), so overlays stay accurate
 * at any zoom without conversion.
 *
 * The device toggle is always rendered; device state comes from the nearest
 * DesignDeviceProvider (hydration + localStorage persistence live there).
 */
export function PreviewShell({
  settings,
  org,
  paragraphs,
  colors,
  orgName,
  onGrowHero,
  children,
  previewHeight = 640,
  menuItems = [],
  srcDocOverride = null,
  previewBadge = false,
}: {
  settings: DesignSettingsV2;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  colors: { bg: string; text: string; accent: string };
  orgName: string;
  onGrowHero?: (id: string, h: number) => void;
  children?: ReactNode;
  previewHeight?: number;
  menuItems?: LiveMenuItem[];
  /** Exact post-apply bytes to preview instead of the live site. */
  srcDocOverride?: string | null;
  /** Show the "preview — not yet applied" badge over the frame. */
  previewBadge?: boolean;
}) {
  const hClass = previewHeight === 640 ? "h-[640px]" : previewHeight === 960 ? "h-[960px]" : previewHeight === 1280 ? "h-[1280px]" : `h-[${previewHeight}px]`;

  const { device, setDevice } = useDesignDevice();
  const [scale, setScale] = useState(1);
  const paneRef = useRef<HTMLDivElement>(null);
  const builtHtml = settings.built_html ?? null;

  // Same fallback as the public layout: hero-only restaurants get one gallery
  // tile instead of an all-placeholder grid.
  const photos = org?.restaurant_photos ?? [];
  const previewGallery =
    photos.length > 0
      ? photos
      : org?.background_image_url
        ? [org.background_image_url]
        : [];

  // Scale the fixed-width frame down to fit the pane (never upscale — a wider
  // pane just centers the design frame with themed margins). Uses transform
  // scale: sticky/fixed elements and tab-switch remeasure stay correct, and
  // anchor scrolling is browser-native (see the nav guard), so no paint tears.
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const frame = DEVICES.find((d) => d.id === device)?.width ?? 1280;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      // Ignore 0-width measures (hidden/backgrounded tab) — they would stick
      // a wrong scale and produce the right-side gap.
      if (w > 0) setScale(Math.min(1, w / frame));
    };
    // Double-rAF: layout after backgrounded tabs can be stale on first read.
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Safari fires pageshow (not focus) on tab/app switch — the gap repro.
    const remeasure = () => {
      requestAnimationFrame(() => requestAnimationFrame(measure));
    };
    const onVis = () => {
      if (document.visibilityState === "visible") remeasure();
    };
    window.addEventListener("focus", remeasure);
    window.addEventListener("pageshow", remeasure);
    window.addEventListener("resize", remeasure);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("focus", remeasure);
      window.removeEventListener("pageshow", remeasure);
      window.removeEventListener("resize", remeasure);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [device]);

  const handleDeviceChange = (next: DeviceKind) => {
    setDevice(next);
  };

  const frameWidth = DEVICES.find((d) => d.id === device)?.width ?? 1280;
  // Tablet/mobile render as a device on a neutral stage: white pane around
  // the frame plus a black border outlining the site itself. Desktop fills
  // the pane with the page background (unchanged).
  const staged = device !== "desktop";
  const safeScale = scale > 0 ? scale : 1;
  // Transform scale (not CSS zoom): zoom breaks inner position:fixed/sticky
  // whenever the scale is not exactly 1 (desktop-only symptom), while the
  // guard's native fragment navigation avoids scripted-scroll paint tears.
  // Rendered size always fills the pane exactly: (previewHeight/scale)*scale.
  const frameStyle: CSSProperties = {
    width: `${frameWidth}px`,
    height: `${previewHeight / safeScale}px`,
    transform: `scale(${safeScale})`,
    transformOrigin: "top center",
    flexShrink: 0,
    ...(staged ? { border: "2px solid #000000", backgroundColor: "#ffffff" } : {}),
  };
  const siteBg = staged ? "#ffffff" : settings.background_color;

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--rule)] bg-[var(--paper-raised)]">
      <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] border-b border-[var(--rule)]">
        <span>Storefront preview</span>
        <div
          role="group"
          aria-label="Preview device width"
          className="flex items-center gap-1"
        >
          {DEVICES.map((d) => {
            const active = d.id === device;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDeviceChange(d.id)}
                aria-pressed={active}
                aria-label={`${d.label} preview (${d.hint})`}
                title={`${d.label} — ${d.hint}`}
                className={
                  active
                    ? "btn btn-accent text-[11px] px-2 py-0.5"
                    : "btn btn-outline text-[11px] px-2 py-0.5"
                }
              >
                {d.label}
                <span className="font-mono opacity-70"> · {d.hint}</span>
              </button>
            );
          })}
        </div>
        <span>{orgName}</span>
      </div>
      <div
        ref={paneRef}
        data-preview-pane
        className="relative flex justify-center overflow-hidden"
        style={{ height: `${previewHeight}px`, backgroundColor: siteBg, color: settings.text_color }}
      >
        <div className="mx-auto" style={frameStyle}>
          {settings.built_html ? (
            // AI-built standalone site: the iframe owns scrolling (same as the
            // live site), so sticky headers stick in preview too.
            // srcDocOverride previews exact post-apply bytes before approval.
            // Interactive overlays (children) target settings elements,
            // so they're hidden here.
            <div className="relative h-full">
              {previewBadge && srcDocOverride && (
                <span className="absolute top-2 left-2 z-10 rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                  Previewing edits — not saved
                </span>
              )}
              <iframe
                key={`${device}-${srcDocOverride ? "patched" : "live"}`}
                title={`${orgName} built-site preview`}
                srcDoc={withPreviewChrome(
                  withBuiltSiteGuards(
                    withLiveGallery(
                      withLiveHeroMobile(
                        withLiveHero(
                          withLiveMenu(srcDocOverride ?? settings.built_html, menuItems),
                          org?.background_image_url ?? null,
                        ),
                        org?.mobile_background_image_url ?? null,
                      ),
                      previewGallery,
                    ),
                  ),
                  frameWidth,
                )}
                sandbox="allow-scripts allow-forms allow-same-origin"
                style={{ display: "block", width: "100%", height: "100%", border: 0, backgroundColor: siteBg }}
              />
            </div>
          ) : (
            <OrgPageView
              mode="preview"
              org={org}
              settings={settings}
              paragraphs={paragraphs}
              colors={colors}
              onGrowHero={onGrowHero}
              previewHeight={previewHeight}
              // Preview truthfulness: resolve per-device fonts/rects from the
              // console toggle, NOT the scaled measured width (scaling shrinks
              // getBoundingClientRect, which would misclassify tablet as mobile).
              device={device}
            />
          )}
          {!settings.built_html && children}
        </div>
      </div>
    </div>
  );
}
