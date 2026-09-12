"use client";

import { useRef, useState, type ReactNode } from "react";
import { clampRect, type Rect } from "@/lib/design";

// Word-style resizable/movable rectangle. Coordinates are % of the parent
// container so the layout is responsive. 8 handles (4 corners + 4 edges).

const HANDLES: { key: string; style: React.CSSProperties; cursor: string }[] = [
  { key: "nw", style: { left: -5, top: -5, cursor: "nwse-resize" }, cursor: "nwse-resize" },
  { key: "n", style: { left: "50%", top: -5, marginLeft: -5, cursor: "ns-resize" }, cursor: "ns-resize" },
  { key: "ne", style: { right: -5, top: -5, cursor: "nesw-resize" }, cursor: "nesw-resize" },
  { key: "e", style: { right: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }, cursor: "ew-resize" },
  { key: "se", style: { right: -5, bottom: -5, cursor: "nwse-resize" }, cursor: "nwse-resize" },
  { key: "s", style: { left: "50%", bottom: -5, marginLeft: -5, cursor: "ns-resize" }, cursor: "ns-resize" },
  { key: "sw", style: { left: -5, bottom: -5, cursor: "nesw-resize" }, cursor: "nesw-resize" },
  { key: "w", style: { left: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }, cursor: "ew-resize" },
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
  positionStyle,
}: {
  rect: Rect;
  onChange: (r: Rect) => void;
  selected?: boolean;
  onSelect?: () => void;
  zIndex?: number;
  label?: string;
  children?: ReactNode;
  className?: string;
  lockMove?: boolean;
  /** Override the computed left/top/width/height with explicit style values. */
  positionStyle?: React.CSSProperties;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | string; startX: number; startY: number; startRect: Rect } | null>(null);

  const toPct = (e: PointerEvent) => {
    const parent = boxRef.current?.parentElement;
    if (!parent) return { dx: 0, dy: 0 };
    const pr = parent.getBoundingClientRect();
    return {
      dx: ((e.clientX - drag.current!.startX) / pr.width) * 100,
      dy: ((e.clientY - drag.current!.startY) / pr.height) * 100,
    };
  };

  const onPointerDown = (e: React.PointerEvent, mode: "move" | string) => {
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    if (mode === "move" && lockMove) return;
    if (onSelect) onSelect();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, startRect: { ...rect } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const [dragging, setDragging] = useState(false);
  const onDragStart = (e: React.PointerEvent, mode: "move" | string) => {
    onPointerDown(e, mode);
    setDragging(true);
  };
  const endDrag = () => { drag.current = null; setDragging(false); };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { dx, dy } = toPct(e.nativeEvent);
    const s = drag.current.startRect;
    const next: Rect = { ...s };
    if (drag.current.mode === "move") {
      next.x = s.x + dx;
      next.y = s.y + dy;
    } else {
      const m = drag.current.mode;
      if (m.includes("w")) { next.x = s.x + dx; next.w = s.w - dx; }
      if (m.includes("e")) { next.w = s.w + dx; }
      if (m.includes("n")) { next.y = s.y + dy; next.h = s.h - dy; }
      if (m.includes("s")) { next.h = s.h + dy; }
    }
    onChange(clampRect(next));
  };

  return (
    <div
      ref={boxRef}
      data-box
      className={`absolute ${className}`}
      style={{
        ...positionStyle,
        left: positionStyle?.left ?? `${rect.x}%`,
        top: positionStyle?.top ?? `${rect.y}%`,
        width: positionStyle?.width ?? `${rect.w}%`,
        height: positionStyle?.height ?? `${rect.h}%`,
        zIndex,
        cursor: dragging ? "grabbing" : "move",
      }}
      onPointerDown={(e) => onDragStart(e, "move")}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
    >
      {/* selection chrome */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors ${
          selected
            ? "border-2 border-sky-400/90 bg-sky-400/10"
            : "border border-white/25 hover:border-white/50"
        }`}
      >
        {selected &&
          HANDLES.map((h) => (
            <span
              key={h.key}
              data-handle
              onPointerDown={(e) => onPointerDown(e, h.key)}
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