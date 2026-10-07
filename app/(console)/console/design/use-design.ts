"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignSettingsV2 } from "@/lib/design";

const HISTORY_LIMIT = 30;
const HINT_TIMEOUT_MS = 2000;

export type DesignHistoryHint = "undid" | "redid" | null;

type DesignControls = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyHint: DesignHistoryHint;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  retrySave: () => void;
};

const noop = () => {};

function disabledControls(): DesignControls {
  return {
    undo: noop,
    redo: noop,
    canUndo: false,
    canRedo: false,
    historyHint: null,
    saving: false,
    saved: false,
    saveError: null,
    retrySave: noop,
  };
}

// ── Module-level bridge ──────────────────────────────────────────────────────
// DesignNav is prop-less and every panel owns its own useDesign instance, so
// the mounted hook publishes its controls here and DesignNav mirrors them via
// useDesignControls(). No panel code needs to change.
let latestControls: DesignControls = disabledControls();
const controlsListeners = new Set<() => void>();

function publishControls(next: DesignControls) {
  latestControls = next;
  controlsListeners.forEach((l) => l());
}

function resetControls() {
  latestControls = disabledControls();
  controlsListeners.forEach((l) => l());
}

/**
 * Read-only mirror of the mounted useDesign instance's undo/redo controls.
 * Used by DesignNav, which renders inside panels but owns no settings state.
 */
export function useDesignControls(): DesignControls {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((x) => x + 1);
    controlsListeners.add(listener);
    return () => {
      controlsListeners.delete(listener);
    };
  }, []);
  return latestControls;
}

/**
 * Shared hook for every design subpage: holds the full settings state in
 * memory and debounces POSTs to /api/design/settings (deep-merge) whenever
 * the panel calls updateSettings with a partial slice.
 *
 * Also maintains undo/redo history (cap 30): every updateSettings call pushes
 * the pre-change snapshot onto `past` and clears `future`. undo()/redo()
 * swap the in-memory settings and save through the same debounced path.
 */
export function useDesign(initialSettings: DesignSettingsV2, orgId: string) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyHint, setHistoryHint] = useState<DesignHistoryHint>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(initialSettings);
  const pastRef = useRef<DesignSettingsV2[]>([]);
  const futureRef = useRef<DesignSettingsV2[]>([]);

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

  // The single debounced-save path used by edits, undo, and redo alike.
  const scheduleSave = useCallback(() => {
    setSaved(false);
    setSaveError(null);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void retrySave();
    }, 450);
  }, [retrySave]);

  const flashHint = useCallback((hint: Exclude<DesignHistoryHint, null>) => {
    setHistoryHint(hint);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHistoryHint(null), HINT_TIMEOUT_MS);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<DesignSettingsV2> | ((prev: DesignSettingsV2) => Partial<DesignSettingsV2>)) => {
      // Functional form reads the LATEST state so rapid successive writes to
      // the same slice (e.g. two per-device font/rect overrides in one tick)
      // can't clobber each other via a stale closure.
      const resolved = typeof patch === "function" ? patch(latestRef.current) : patch;
      pastRef.current.push(structuredClone(latestRef.current));
      if (pastRef.current.length > HISTORY_LIMIT) {
        pastRef.current.splice(0, pastRef.current.length - HISTORY_LIMIT);
      }
      futureRef.current = [];
      setCanUndo(true);
      setCanRedo(false);

      const next = { ...latestRef.current, ...resolved } as DesignSettingsV2;
      latestRef.current = next;
      setSettings(next);

      scheduleSave();
    },
    [scheduleSave],
  );

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    // A debounced save may still be pending. latestRef already holds the
    // newest in-memory state, so cancelling the timer loses nothing — the
    // snapshot pushed to `future` below includes those pending edits.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    futureRef.current.push(structuredClone(latestRef.current));
    latestRef.current = prev;
    setSettings(prev);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
    flashHint("undid");
    scheduleSave();
  }, [scheduleSave, flashHint]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pastRef.current.push(structuredClone(latestRef.current));
    latestRef.current = next;
    setSettings(next);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
    flashHint("redid");
    scheduleSave();
  }, [scheduleSave, flashHint]);

  // Publish fresh controls after every render so DesignNav stays in sync.
  useEffect(() => {
    publishControls({
      undo,
      redo,
      canUndo,
      canRedo,
      historyHint,
      saving,
      saved,
      saveError,
      retrySave,
    });
  });

  // Reset on unmount so a stale instance's controls can't linger.
  useEffect(() => {
    return () => {
      resetControls();
    };
  }, []);

  return {
    settings,
    updateSettings,
    saving,
    saved,
    saveError,
    retrySave,
    undo,
    redo,
    canUndo,
    canRedo,
    historyHint,
  };
}
