"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/console/design", label: "Design" },
  { href: "/console/design/hero", label: "Hero" },
  { href: "/console/design/content", label: "Content" },
  { href: "/console/design/image_gen", label: "Image Gen" },
];

export function DesignNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-2 mb-6">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
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
    </nav>
  );
}