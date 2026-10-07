"use client";

import { useEffect, useState } from "react";
import type { DeviceKind } from "./design";

/**
 * Viewport device kind: matchMedia("(max-width: 639px)") → mobile,
 * "(max-width: 1023px)" → tablet, else desktop. SSR-safe default
 * "desktop"; subscribes to changes and cleans up. No deps.
 */
export function useViewportDevice(): DeviceKind {
  const [device, setDevice] = useState<DeviceKind>("desktop");

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mqMobile = window.matchMedia("(max-width: 639px)");
    const mqTablet = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      if (mqMobile.matches) setDevice("mobile");
      else if (mqTablet.matches) setDevice("tablet");
      else setDevice("desktop");
    };
    sync();
    mqMobile.addEventListener("change", sync);
    mqTablet.addEventListener("change", sync);
    return () => {
      mqMobile.removeEventListener("change", sync);
      mqTablet.removeEventListener("change", sync);
    };
  }, []);

  return device;
}
