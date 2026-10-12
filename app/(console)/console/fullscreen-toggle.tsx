"use client";

import { useEffect, useRef, useState } from "react";
import { useConsoleFullscreen } from "./use-console-fullscreen";

function ExpandIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

function CompressIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="M14 10l7-7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

/**
 * Header fullscreen toggle for the operator console (staff + owner).
 * Desktop/tablet only — hidden below the md breakpoint.
 */
export function FullscreenToggle() {
  const { isSupported, isActive, toggle } = useConsoleFullscreen();
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show "Press Esc to exit" briefly after each successful enter.
  useEffect(() => {
    if (isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync transient hint to external fullscreen state change
      setShowHint(true);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setShowHint(false), 3000);
    } else {
      setShowHint(false);
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
        hintTimer.current = null;
      }
    }
    return () => {
      if (hintTimer.current) {
        clearTimeout(hintTimer.current);
        hintTimer.current = null;
      }
    };
  }, [isActive]);

  if (!isSupported) return null;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isActive}
        aria-label={isActive ? "Exit full screen mode" : "Enter full screen mode"}
        title={isActive ? "Exit full screen (Esc)" : "Enter full screen"}
        className={`hidden md:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] cursor-pointer ${
          isActive
            ? "border border-[var(--rule-strong)] bg-[var(--paper-overlay)] text-[var(--ink)] hover:opacity-80"
            : "bg-[var(--accent)] text-white hover:opacity-90"
        }`}
      >
        {isActive ? <CompressIcon /> : <ExpandIcon />}
        <span>{isActive ? "Exit" : "Full Screen"}</span>
      </button>

      {showHint && isActive && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
          <div
            role="status"
            className="console-fullscreen-toast rounded-md border border-white/25 bg-neutral-900/95 px-3 py-2 text-xs font-medium text-white shadow-xl backdrop-blur"
          >
            Press{" "}
            <kbd className="rounded border border-white/25 bg-white/10 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-white">
              Esc
            </kbd>{" "}
            to exit fullscreen
          </div>
        </div>
      )}
    </>
  );
}
