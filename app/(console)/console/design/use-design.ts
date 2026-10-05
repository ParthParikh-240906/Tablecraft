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
  const [saveError, setSaveError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(initialSettings);

  const retrySave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/design/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, design_settings: latestRef.current }),
      });
      if (!res.ok) {
        let msg = `Save failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch { /* keep default */ }
        setSaveError(msg);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Network error — changes not saved. Check connection and retry.");
    } finally {
      setSaving(false);
    }
  }, [orgId]);

  const updateSettings = useCallback(
    (patch: Partial<DesignSettingsV2>) => {
      const next = { ...latestRef.current, ...patch } as DesignSettingsV2;
      latestRef.current = next;
      setSettings(next);
      setSaved(false);
      setSaveError(null);

      clearTimeout(timerRef.current!);
      timerRef.current = setTimeout(() => {
        void retrySave();
      }, 450);
    },
    [retrySave],
  );

  return { settings, updateSettings, saving, saved, saveError, retrySave };
}