"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * ViewSiteLink — opens the public restaurant site in a new tab on desktop,
 * same tab on mobile (rare, but avoids stranding mobile users without a
 * back path). Mobile = coarse pointer or narrow viewport.
 */
export function ViewSiteLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const [newTab, setNewTab] = useState(true);
  useEffect(() => {
    try {
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      setNewTab(!coarse && window.innerWidth >= 720);
    } catch {
      setNewTab(true);
    }
  }, []);
  return newTab ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ) : (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
