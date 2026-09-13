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
    const dy = ((e.clientY - startY) / pr.height) * 100;

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

  return (
    <div
      ref={boxRef}
      className={`absolute ${className}`}
      style={{
        ...positionStyle,
        left: positionStyle?.left ?? `${rect.x}%`,
        top: positionStyle?.top ?? `${rect.y}%`,
        width: positionStyle?.width ?? `${rect.w}%`,
        height: positionStyle?.height ?? `${rect.h}%`,
        zIndex,
        cursor: "move",
      }}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className={`absolute inset-0 pointer-events-none transition-colors ${
          selected ? "border-2 border-sky-400/90 bg-sky-400/10" : "border border-white/25 hover:border-white/50"
        }`}
      >
        {selected &&
          !multiMode &&
          HANDLES.map((h) => (
            <span
              key={h.key}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e, h.key);
              }}
              className="absolute h-[10px] w-[10px] rounded-full bg-white border-2 border-sky-500 shadow pointer-events-auto"
              style={h.style}
            />
          ))}
      </div>
      {label && selected && (
        <span className="absolute -top-6 left-0 text-[10px] font-mono uppercase tracking-wider bg-sky-500 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="absolute inset-0 overflow-hidden">{children}</div>
    </div>
  );
}
