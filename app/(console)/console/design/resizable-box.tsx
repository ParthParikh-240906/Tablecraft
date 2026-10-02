"use client";

import { useRef, type ReactNode } from "react";
import { clampRect, type Rect } from "@/lib/design";

const HANDLES: { key: string; style: React.CSSProperties }[] = [
  { key: "nw", style: { left: -5, top: -5, cursor: "nwse-resize" } },
  { key: "n", style: { left: "50%", top: -5, marginLeft: -5, cursor: "ns-resize" } },
  { key: "ne", style: { right: -5, top: -5, cursor: "nesw-resize" } },
  { key: "e", style: { right: -5, top: "50%", marginTop: -5, cursor: "ew-resize" } },
  { key: "se", style: { right: -5, bottom: -5, cursor: "nwse-resize" } },
  { key: "s", style: { left: "50%", bottom: -5, marginLeft: -5, cursor: "ns-resize" } },
  { key: "sw", style: { left: -5, bottom: -5, cursor: "nesw-resize" } },
  { key: "w", style: { left: -5, top: "50%", marginTop: -5, cursor: "ew-resize" } },
];

export function ResizableBox({
  rect,
  onChange,
  selected,
  onSelect,
  zIndex,
  label,
  children,
  className = "",
  lockMove = false,
  maxY = 100,
  positionStyle,
  multiMode = false,
  onMove,
  unit = "pct",
}: {
  rect: Rect;
  onChange: (r: Rect) => void;
  selected?: boolean;
  onSelect?: (e: React.PointerEvent) => void;
  zIndex?: number;
  label?: string;
  children?: ReactNode;
  className?: string;
  lockMove?: boolean;
  maxY?: number;
  positionStyle?: React.CSSProperties;
  /** Part of a multi-selection: dragging emits deltas (onMove) instead of an
   *  absolute rect, and resize handles are hidden (group move only). */
  multiMode?: boolean;
  onMove?: (dx: number, dy: number) => void;
  unit?: "pct" | "cvH";
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: string; startX: number; startY: number; startRect: Rect } | null>(null);

  const onPointerDown = (e: React.PointerEvent, mode: string) => {
    if (mode === "move" && lockMove) return;
    if (onSelect) onSelect(e);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, startRect: { ...rect } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { mode, startX, startY, startRect } = drag.current;
    const parent = boxRef.current?.parentElement;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();

    const dx = ((e.clientX - startX) / pr.width) * 100;
    const dy = unit === "cvH"
      ? (e.clientY - startY) / (pr.width * 0.008)
      : ((e.clientY - startY) / pr.height) * 100;

    if (mode === "move" && multiMode) {
      if (onMove) onMove(dx, dy);
      return;
    }

    const next: Rect = { ...startRect };
    if (mode === "move") {
      next.x = startRect.x + dx;
      next.y = startRect.y + dy;
    } else {
      if (mode.includes("w")) { next.x = startRect.x + dx; next.w = startRect.w - dx; }
      if (mode.includes("e")) { next.w = startRect.w + dx; }
      if (mode.includes("n")) { next.y = startRect.y + dy; next.h = startRect.h - dy; }
      if (mode.includes("s")) { next.h = startRect.h + dy; }
    }
    onChange(clampRect(next, 3, maxY));
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const posStyle: React.CSSProperties = unit === "cvH"
    ? {
        left: positionStyle?.left ?? `${rect.x}%`,
        top: positionStyle?.top ?? `calc(${((rect.y * 0.8) / 100).toFixed(5)} * 100cqw)`,
        width: positionStyle?.width ?? `${rect.w}%`,
        height: positionStyle?.height ?? `calc(${((rect.h * 0.8) / 100).toFixed(5)} * 100cqw)`,
        ...positionStyle,
      }
    : {
        left: positionStyle?.left ?? `${rect.x}%`,
        top: positionStyle?.top ?? `${rect.y}%`,
        width: positionStyle?.width ?? `${rect.w}%`,
        height: positionStyle?.height ?? `${rect.h}%`,
        ...positionStyle,
      };

  return (
    <div
      ref={boxRef}
      className={`absolute ${className}`}
      style={{
        ...posStyle,
        zIndex,
        pointerEvents: "none",
      }}
    >
      {/* Visual outline + drag surface — only shown when selected */}
      {selected && (
        <div
          className="absolute inset-0 border-2 border-sky-400 bg-sky-400/10 pointer-events-auto cursor-move select-none"
          onPointerDown={(e) => onPointerDown(e, "move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {label && (
            <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-sky-500 text-white text-[10px] font-mono tracking-wide uppercase shadow select-none">
              {label}
            </span>
          )}
        </div>
      )}

      {/* Resize handles — hidden in multi-select mode so dragging moves the group */}
      {selected &&
        !multiMode &&
        HANDLES.map((h) => (
          <div
            key={h.key}
            style={h.style}
            className="absolute h-[10px] w-[10px] rounded-full bg-white border-2 border-sky-500 shadow pointer-events-auto"
            onPointerDown={(e) => onPointerDown(e, h.key)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        ))}

      {/* Unselected click target — allows clicking the box to select it */}
      {!selected && (
        <div
          className="absolute inset-0 pointer-events-auto cursor-pointer hover:border hover:border-sky-400/60 transition-colors"
          onPointerDown={(e) => onPointerDown(e, "move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}

      {children}
    </div>
  );
}
