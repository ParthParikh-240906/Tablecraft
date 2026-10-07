"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDesignControls } from "./use-design";

const LINKS = [
  { href: "/console/design", label: "Header" },
  { href: "/console/design/hero", label: "Hero" },
  { href: "/console/design/content", label: "Content" },
  { href: "/console/design/menu", label: "Menu Page" },
  { href: "/console/design/book_a_table", label: "Book a Table" },
  { href: "/console/design/ai", label: "AI" },
  { href: "/console/design/themes", label: "Themes" },
];

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function DesignNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgParam = searchParams.get("org");
  const query = orgParam ? `?org=${encodeURIComponent(orgParam)}` : "";
  const { undo, redo, canUndo, canRedo, historyHint } = useDesignControls();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <nav className="flex flex-wrap items-center gap-2 mb-6">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={`${l.href}${query}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
              active
                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                : "border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <div className="ml-auto flex items-center gap-2">
        {historyHint && (
          <span className="text-xs text-[var(--ink-faint)]">
            {historyHint === "undid" ? "Undid change" : "Redid change"}
          </span>
        )}
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
          className="btn btn-outline text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↩ Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="btn btn-outline text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↪ Redo
        </button>
      </div>
    </nav>
  );
}
