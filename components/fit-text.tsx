"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Text box that grows its rect to fit its content.
 * Measures the rendered text and reports the needed height in % of the
 * preview band (bandPx = the band's pixel height). Only grows — a manual
 * handle-drag to a larger size is never overridden; shrinking below the
 * text height snaps back on the next font/content/width change.
 * Pass no onGrow to render a plain (non-measuring) box — used on the site.
 *
 * bandPx changes whenever ANY content element resizes (because contentPx
 * depends on contentMax, which is driven by all element heights). To avoid
 * an infinite re-measure loop, bandPx is cached in a ref and only the
 * REFERENCE is checked on width-change events — not the prop itself.
 */
export function FitText({
  bandPx,
  minHPct = 5,
  onGrow,
  fontSize,
  fontFamily,
  text,
  widthPct,
  className,
  style,
  children,
}: {
  bandPx?: number;
  minHPct?: number;
  onGrow?: (hPct: number) => void;
  /** Identifiers that trigger a re-measure when they change. */
  fontSize?: number;
  fontFamily?: string;
  text?: string;
  widthPct?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const bandPxRef = useRef(bandPx);
  const lastCalledH = useRef(0);
  const lastWidth = useRef(0);
  const widthDirty = useRef(false);

  // Keep the ref in sync with the current bandPx prop (used when prop changes
  // from font/size updates, not from sibling element growth).
  useEffect(() => {
    bandPxRef.current = bandPx;
  }, [bandPx]);

  useEffect(() => {
    if (!onGrow || !ref.current) return;
    const div = ref.current;

    const measure = () => {
      if (!ref.current) return;
      const currentBand = bandPxRef.current;
      if (!currentBand) return;
      const needed = ref.current.scrollHeight + 2;
      const pxPerPct = currentBand / 100;
      const nextH = Math.min(100, Math.max(minHPct, Math.ceil(needed / pxPerPct)));
      if (nextH !== lastCalledH.current) {
        lastCalledH.current = nextH;
        onGrow(nextH);
      }
    };

    const id = requestAnimationFrame(measure);

    // Re-measure only when the CONTAINER width actually changes (not when
    // individual elements inside it change height).
    const parent = div.parentElement;
    let ro: ResizeObserver | null = null;
    if (parent) {
      ro = new ResizeObserver(() => {
        const w = parent.clientWidth;
        if (Math.abs(w - lastWidth.current) > 2) {
          lastWidth.current = w;
          // Width changed — sync the band height ref from the prop so the
          // next measure uses the up-to-date value, then trigger measurement.
          bandPxRef.current = bandPx;
          widthDirty.current = true;
        }
        if (widthDirty.current) {
          const wid = requestAnimationFrame(measure);
          widthDirty.current = false;
          return () => cancelAnimationFrame(wid);
        }
      });
      ro.observe(parent);
      lastWidth.current = parent.clientWidth;
    }

    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bandPx is read via ref to avoid cascade
  }, [fontSize, fontFamily, text, widthPct, minHPct]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
