"use client";

import type { ReactNode } from "react";

/**
 * Explicit two-column stacks for every design subsection's editables. Each
 * column stacks independently from the same top edge, so blocks never leave
 * row gaps — and each page pins its key block to a chosen side (Content
 * Templates, Menu Item Name, and AI Image Gallery all live on the right).
 * Mobile stays a single column (left stack, then right stack).
 */
export function EditableColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid md:grid-cols-2 gap-5 items-start">
      <div className="space-y-5 min-w-0">{left}</div>
      <div className="space-y-5 min-w-0">{right}</div>
    </div>
  );
}

/**
 * Uniform editable rectangle with the marketing "How it works" hover lift:
 * the card raises and the orange rule brightens on hover — applied to every
 * editable box across all design subpages. Pass `hover={false}` only to opt
 * a card out.
 */
export function EditableCard({
  title,
  children,
  hover = true,
  className = "",
}: {
  title: string;
  children: ReactNode;
  hover?: boolean;
  className?: string;
}) {
  return (
    <section
      className={[
        "ticket p-6 space-y-4 relative overflow-hidden",
        hover ? "group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h3 className="font-display text-sm font-semibold text-[var(--ink)]">
        {title}
      </h3>
      {children}
      {hover && (
        <div className="h-px bg-[var(--accent)]/40 group-hover:bg-[var(--accent)] transition-colors duration-300" />
      )}
    </section>
  );
}

/**
 * Inner 2-rectangles-side-by-side split for text edit cards:
 * left = editable text, right = style controls.
 */
export function EditableSplit({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded border border-[var(--rule)] p-3 space-y-2 bg-[var(--paper-overlay)]/20">
        {left}
      </div>
      <div className="rounded border border-[var(--rule)] p-3 space-y-3">
        {right}
      </div>
    </div>
  );
}
