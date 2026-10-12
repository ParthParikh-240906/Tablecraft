"use client";

import { useCallback, useEffect, useState } from "react";

export type CartLine = { id: string; quantity: number };
export type CartMap = Record<string, number>;

function keyFor(slug: string): string {
  return `tablecraft_cart_${slug}`;
}

function readCart(slug: string): CartMap {
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: CartMap = {};
    for (const [id, qty] of Object.entries(parsed)) {
      const q = Math.floor(Number(qty));
      if (typeof id === "string" && id && Number.isInteger(q) && q >= 1 && q <= 99) {
        out[id] = q;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Guest cart state, persisted per-restaurant in localStorage.
 * Same-tab updates apply instantly; other tabs sync via storage events.
 */
export function useCart(orgSlug: string) {
  const [lines, setLines] = useState<CartMap>({});

  useEffect(() => {
    setLines(readCart(orgSlug));
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyFor(orgSlug)) setLines(readCart(orgSlug));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [orgSlug]);

  const persist = useCallback(
    (next: CartMap) => {
      setLines(next);
      try {
        window.localStorage.setItem(keyFor(orgSlug), JSON.stringify(next));
      } catch {}
    },
    [orgSlug],
  );

  const add = useCallback(
    (id: string, qty = 1) => {
      const next = { ...readCart(orgSlug) };
      next[id] = Math.min(99, (next[id] ?? 0) + Math.max(1, Math.floor(qty)));
      persist(next);
    },
    [orgSlug, persist],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      const next = { ...readCart(orgSlug) };
      const q = Math.floor(qty);
      if (q <= 0) delete next[id];
      else next[id] = Math.min(99, q);
      persist(next);
    },
    [orgSlug, persist],
  );

  const clear = useCallback(() => persist({}), [persist]);

  const count = Object.values(lines).reduce((a, b) => a + b, 0);

  return { lines, count, add, setQty, clear };
}
