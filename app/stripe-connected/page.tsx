"use client";

import { useEffect } from "react";

/**
 * Popup landing page for Stripe Connect onboarding (return + refresh URLs).
 * Notifies the console tab and closes itself — the opener polls
 * /api/stripe/connect/status until the account goes active.
 */
export default function StripeConnectedPage() {
  useEffect(() => {
    try {
      window.opener?.postMessage("stripe-connected", window.location.origin);
    } catch {}
    const t = setTimeout(() => {
      try {
        window.close();
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-[var(--ink)]">
      <div className="text-center space-y-2">
        <p className="font-display text-xl">Stripe connected ✓</p>
        <p className="text-sm text-[var(--ink-soft)]">You can close this window and return to the console.</p>
      </div>
    </div>
  );
}
