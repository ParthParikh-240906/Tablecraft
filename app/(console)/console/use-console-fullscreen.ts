"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ConsoleFullscreen {
  isSupported: boolean;
  isActive: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function isFullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void | Promise<void>;
  };
  return (
    typeof el.requestFullscreen === "function" ||
    typeof el.webkitRequestFullscreen === "function"
  );
}

/**
 * Desktop/tablet fullscreen for the operator console.
 * Targets documentElement so browser tabs + URL bar are hidden.
 * Persists opt-in preference; browsers still require a user gesture to enter.
 */
export function useConsoleFullscreen(): ConsoleFullscreen {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount hydration: Fullscreen API only exists in the browser
    setIsSupported(isFullscreenSupported());
    setIsActive(getFullscreenElement() !== null);

    const onChange = () => {
      setIsActive(getFullscreenElement() !== null);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as EventListener);
    };
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // ignore — Wake Lock is best-effort for kitchen displays
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  const enter = useCallback(async () => {
    try {
      try {
        window.localStorage.setItem("tablecraft_console_fullscreen", "1");
      } catch {}
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => void | Promise<void>;
      };
      if (typeof el.requestFullscreen === "function") {
        await el.requestFullscreen();
      } else if (typeof el.webkitRequestFullscreen === "function") {
        await el.webkitRequestFullscreen();
      }
      // Keep kitchen / counter displays awake while fullscreen. Best-effort.
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          wakeLockRef.current = await nav.wakeLock.request("screen");
        }
      } catch {}
    } catch {
      // requestFullscreen rejects without a user gesture or in an iframe
      // without allowfullscreen — button stays in Enter state.
    }
  }, []);

  const exit = useCallback(async () => {
    try {
      try {
        window.localStorage.removeItem("tablecraft_console_fullscreen");
      } catch {}
      const doc = document as Document & {
        webkitExitFullscreen?: () => void | Promise<void>;
        webkitFullscreenElement?: Element | null;
      };
      if (typeof document.exitFullscreen === "function" && document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (
        typeof doc.webkitExitFullscreen === "function" &&
        (doc.webkitFullscreenElement || document.fullscreenElement)
      ) {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // ignore exit errors (e.g. user already pressed Esc)
    } finally {
      await releaseWakeLock();
    }
  }, [releaseWakeLock]);

  const toggle = useCallback(async () => {
    if (getFullscreenElement() !== null) {
      await exit();
    } else {
      await enter();
    }
  }, [enter, exit]);

  // Reduce accidental data loss while fullscreen: confirm on refresh/close.
  // Fullscreen alone hides tabs but cannot block reload by design.
  useEffect(() => {
    if (!isActive) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isActive]);

  // Release wake lock if user exits via Esc (no button click).
  useEffect(() => {
    if (!isActive) {
      releaseWakeLock();
    }
  }, [isActive, releaseWakeLock]);

  return { isSupported, isActive, enter, exit, toggle };
}
