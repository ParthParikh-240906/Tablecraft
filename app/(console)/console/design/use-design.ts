"use client";

import { useCallback, useRef, useState } from "react";
import type { DesignSettingsV2 } from "@/lib/design";

/**
 * Shared hook for every design subpage: holds the full settings state in
 * memory and debounces POSTs to /api/design/settings (deep-merge) whenever
 * the panel calls updateSettings with a partial slice.
 */
export function useDesign(initialSettings: DesignSettingsV2, orgId: string) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(initialSettings);

  const updateSettings = useCallback(
    (patch: Partial<DesignSettingsV2>) => {
      const next = { ...latestRef.current, ...patch } as DesignSettingsV2;
      latestRef.current = next;
      setSettings(next);
      setSaved(false);

      clearTimeout(timerRef.current!);
      timerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch("/api/design/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ org_id: orgId, design_settings: latestRef.current }),
          });
        } catch { /* next edit retries */ }
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }, 450);
    },
    [orgId],
  );

  return { settings, updateSettings, saving, saved };
}