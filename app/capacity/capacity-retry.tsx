"use client";

import { useEffect } from "react";

/**
 * The proxy rewrites the blocked URL to /capacity while keeping the original
 * address in the browser. Reloading therefore re-runs the gate for the page the
 * visitor actually wanted (a meta refresh would just hit /capacity again).
 */
export function CapacityRetry() {
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), 30_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="btn btn-accent text-xs"
    >
      Try again
    </button>
  );
}
