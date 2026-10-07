"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { type DesignSettingsV2, type DeviceKind } from "@/lib/design";
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
}: {
  settings: DesignSettingsV2;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  colors: { bg: string; text: string; accent: string };
  orgName: string;
  onGrowHero?: (id: string, h: number) => void;
  children?: ReactNode;
  previewHeight?: number;
}) {
  const hClass = previewHeight === 640 ? "h-[640px]" : previewHeight === 960 ? "h-[960px]" : previewHeight === 1280 ? "h-[1280px]" : `h-[${previewHeight}px]`;

  const { device, setDevice } = useDesignDevice();
  const [zoom, setZoom] = useState(1);
  const paneRef = useRef<HTMLDivElement>(null);

  // Zoom the fixed-width frame down to fit the pane (never upscale — a wider
  // pane just centers the 1280 design frame with margins).
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const frame = DEVICES.find((d) => d.id === device)?.width ?? 1280;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setZoom(Math.min(1, w / frame));
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fit before first paint feedback
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  const handleDeviceChange = (next: DeviceKind) => {
    setDevice(next);
  };

  const frameWidth = DEVICES.find((d) => d.id === device)?.width ?? 1280;
  // Tablet/mobile render as a device on a neutral stage: white pane around
  // the frame plus a black border outlining the site itself. Desktop fills
  // the pane with the page background (unchanged).
  const staged = device !== "desktop";
  const frameStyle: CSSProperties = staged
    // Shrink the content box by the border width so the outer size stays
    // exactly the device width (no overflow clipping under zoom).
    ? { width: `${frameWidth - 4}px`, zoom, border: "2px solid #000000", backgroundColor: "#ffffff" }
    : { width: `${frameWidth}px`, zoom };

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
        className="overflow-y-auto overflow-x-hidden relative scroll-smooth transition-[height] duration-200 motion-reduce:transition-none"
        style={{ height: `${previewHeight}px`, backgroundColor: staged ? "#ffffff" : settings.background_color, color: settings.text_color }}
      >
        <div className="mx-auto" style={frameStyle}>
          <OrgPageView
            mode="preview"
            org={org}
            settings={settings}
            paragraphs={paragraphs}
            colors={colors}
            onGrowHero={onGrowHero}
            previewHeight={previewHeight}
            // Preview truthfulness: resolve per-device fonts/rects from the
            // console toggle, NOT the zoomed measured width (zoom shrinks
            // getBoundingClientRect, which would misclassify tablet as mobile).
            device={device}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
