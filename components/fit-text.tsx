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
 * bandPx is read via a ref (not a dep) to avoid cascading re-measures
 * whenever ANY content element resizes — only real container-width changes
 * (detected via ResizeObserver) should trigger a re-measure.
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

  // Keep the ref in sync with the current bandPx prop.
  useEffect(() => {
    bandPxRef.current = bandPx;
  }, [bandPx]);

  useEffect(() => {
    if (!onGrow || !bandPx || !ref.current) return;
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
        const wid = requestAnimationFrame(measure);
        return () => cancelAnimationFrame(wid);
      });
      ro.observe(parent);
    }

    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onGrow is stable per element; bandPx is read via ref
  }, [fontSize, fontFamily, text, widthPct, minHPct]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
