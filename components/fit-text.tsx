"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Text box that grows its rect to fit its content.
 * Measures the rendered text and reports the needed height in % of the
 * preview band (bandPx = the band's pixel height). Only grows — a manual
 * handle-drag to a larger size is never overridden; shrinking below the
 * text height snaps back on the next font/content/width change.
 * Pass no onGrow to render a plain (non-measuring) box — used on the site.
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

  useEffect(() => {
    if (!onGrow || !bandPx || !ref.current) return;
    const div = ref.current;
    const needed = div.scrollHeight + 2;
    if (needed > div.clientHeight) {
      onGrow(Math.min(100, Math.max(minHPct, Math.ceil((needed / bandPx) * 100))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onGrow is stable per element
  }, [fontSize, fontFamily, text, widthPct, bandPx]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}