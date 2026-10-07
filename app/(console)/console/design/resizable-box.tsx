"use client";

import { useEffect, useRef, type ReactNode } from "react";
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

/** Pointer must travel this far (screen px) before a press becomes a drag —
 *  plain clicks (select) never commit a rect change. */
const DRAG_THRESHOLD_PX = 3;

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
  elementId,
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
  /** Stable element id — rendered as `data-el-id` so editor list clicks can
   *  locate this box inside the preview pane and scroll it into view. */
  elementId?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: string;
    startX: number;
    startY: number;
    startRect: Rect;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  // Handlers attached to window must see the latest props without re-binding.
  const latest = useRef({ onChange, onMove, multiMode, unit, maxY });
  // Refreshed after every render (no setState — just a mutable snapshot for
  // the window listeners below).
  useEffect(() => {
    latest.current = { onChange, onMove, multiMode, unit, maxY };
  });

  // Window-level move/up/cancel tracking for the active drag. Registered once
  // — the drag ref + latest-props ref carry everything the handler needs, so
  // tracking survives re-renders (e.g. select → selected DOM change) and fast
  // pointers that leave the box mid-gesture.
  useEffect(() => {
    const onWindowMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (e.pointerId !== d.pointerId) return;
      const box = boxRef.current;
      const parent = box?.parentElement;
      if (!parent) return;
      // Threshold: a plain click that selects the box must not nudge it.
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      const { mode, startX, startY, startRect } = d;
      const { onChange: fireChange, onMove: fireMove, multiMode: mm, unit: u, maxY: my } = latest.current;
      const pr = parent.getBoundingClientRect();
      if (pr.width <= 0 || pr.height <= 0) return;

      const dx = ((e.clientX - startX) / pr.width) * 100;
      const dy = u === "cvH"
        ? (e.clientY - startY) / (pr.width * 0.008)
        : ((e.clientY - startY) / pr.height) * 100;

      if (mode === "move" && mm) {
        if (fireMove) fireMove(dx, dy);
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
      fireChange(clampRect(next, 3, my));
    };
    const endDrag = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
    };
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent, mode: string) => {
    if (mode === "move" && lockMove) return;
    if (onSelect) onSelect(e);
    drag.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...rect },
      moved: false,
      pointerId: e.pointerId,
    };
    // Capture on the pressed surface (not e.target, which may be the child
    // label) so the gesture keeps flowing even over child nodes. The window
    // listeners above are the real tracking path; capture is belt-and-braces
    // for touch. Capture is released implicitly on pointerup/cancel.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* noop — window listeners still track */ }
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
      data-el-id={elementId}
      className={`absolute ${className}`}
      style={{
        ...posStyle,
        zIndex,
        pointerEvents: "none",
      }}
    >
      {/* Single stable move surface — always the same DOM node whether or not
        the box is selected, so starting a drag on the click that selects it
        no longer loses pointer capture to a swapped-out element (the old
        first-drag "runaway" bug). touch-none keeps mobile drags from
        becoming scrolls. */}
      <div
        className={`absolute inset-0 pointer-events-auto touch-none select-none ${
          selected
            ? "border-2 border-sky-400 bg-sky-400/10 cursor-move"
            : "cursor-pointer hover:border hover:border-sky-400/60 transition-colors"
        }`}
        onPointerDown={(e) => onPointerDown(e, "move")}
      >
        {selected && label && (
          <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-sky-500 text-white text-[10px] font-mono tracking-wide uppercase shadow select-none">
            {label}
          </span>
        )}
      </div>

      {/* Resize handles — hidden in multi-select mode so dragging moves the group */}
      {selected &&
        !multiMode &&
        HANDLES.map((h) => (
          <div
            key={h.key}
            style={h.style}
            className="absolute h-[10px] w-[10px] rounded-full bg-white border-2 border-sky-500 shadow pointer-events-auto touch-none"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDown(e, h.key);
            }}
          />
        ))}

      {children}
    </div>
  );
}
