"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DeviceKind } from "@/lib/design";

const DEVICE_STORAGE_KEY = "tablecraft_preview_device";

const DEFAULT_DEVICE: DeviceKind = "desktop";

function isDeviceKind(v: unknown): v is DeviceKind {
  return v === "desktop" || v === "tablet" || v === "mobile";
}

const DesignDeviceContext = createContext<{
  device: DeviceKind;
  setDevice: (d: DeviceKind) => void;
}>({
  device: DEFAULT_DEVICE,
  // Noop default so preview-only usages render outside a provider too.
  setDevice: () => {},
});

/**
 * Owns the console's per-device editing context. Hydrates the persisted
 * choice post-mount (same pattern the preview shell used before) and
 * persists on change. Panels that offer per-device editing must wrap their
 * tree in this provider so their PreviewShell toggle and DesignField inputs
 * share one device.
 */
export function DesignDeviceProvider({ children }: { children: ReactNode }) {
  const [device, setDeviceState] = useState<DeviceKind>(DEFAULT_DEVICE);

  // Hydrate persisted choice post-mount to avoid SSR hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isDeviceKind(raw)) setDeviceState(raw);
    } catch {}
  }, []);

  const setDevice = (d: DeviceKind) => {
    setDeviceState(d);
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, d);
    } catch {}
  };

  return (
    <DesignDeviceContext.Provider value={{ device, setDevice }}>
      {children}
    </DesignDeviceContext.Provider>
  );
}

/**
 * Returns the current console device. Safe outside a provider — falls back
 * to `{ device: "desktop", setDevice: noop }` so preview-only usages keep
 * rendering (the device toggle is inert until the panel adds the provider).
 */
export function useDesignDevice(): {
  device: DeviceKind;
  setDevice: (d: DeviceKind) => void;
} {
  return useContext(DesignDeviceContext);
}
