"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PLAN_MONTHLY_AED, type PaidPlanKey } from "@/lib/pricing";

export interface OrgMetricData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: "free" | "pro" | "max";
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  currentPeriodEnd: string | null;
  staffRole: string;
  totalEarningsAed: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  pendingOrdersAed: number;
  totalBookingsCount: number;
  totalTablesCount: number;
}

export function PricingClient({
  activeOrgId,
  userEmail,
  orgs,
  accessDeniedOrgName,
}: {
  activeOrgId: string;
  userEmail: string;
  orgs: OrgMetricData[];
  accessDeniedOrgName?: string | null;
}) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(activeOrgId || orgs[0]?.id || "");
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanKey | "portal" | "cancel" | "sync" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasCanceled, setHasCanceled] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-refresh after Stripe checkout completes (polls until webhook updates DB)
  useEffect(() => {
    const param = searchParams.get("checkout");
    if (!param) return;

    // Only poll once per page session — don't re-poll after router.refresh()
    const key = `pricing_poll_${param}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    let attempts = 0;
    const maxAttempts = 15; // ~30s total (15 × 2s)

    const poll = async () => {
      attempts++;
      if (attempts >= maxAttempts) return;
      await new Promise((r) => setTimeout(r, 2000));
      router.refresh();
    };
    poll();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) || orgs[0];

  // Aggregate metrics across all user-owned restaurants
  const totalCombinedEarnings = orgs.reduce((acc, o) => acc + o.totalEarningsAed, 0);
  const totalCombinedOrders = orgs.reduce((acc, o) => acc + o.paidOrdersCount, 0);
  const totalCombinedBookings = orgs.reduce((acc, o) => acc + o.totalBookingsCount, 0);
  const totalCombinedTables = orgs.reduce((acc, o) => acc + o.totalTablesCount, 0);

  const handleUpgrade = async (plan: PaidPlanKey) => {
    if (!selectedOrg) return;
    setErrorMsg(null);
    setLoadingPlan(plan);

    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          orgId: selectedOrg.id,
          orgSlug: selectedOrg.slug,
          email: userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        // New subscription — redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.upgraded) {
        // Existing subscription upgraded server-side — go straight to success
        window.location.href = data.successUrl;
      } else {
        throw new Error("No checkout URL returned by server");
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setErrorMsg(err.message || "Could not initiate upgrade. Please try again.");
      setLoadingPlan(null);
    }
  };

  const handleSyncPlan = async () => {
    if (!selectedOrg) return;
    setLoadingPlan("sync");
    try {
      const res = await fetch("/api/subscription/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug: selectedOrg.slug }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Sync failed");
      router.refresh();
    } catch (err: any) {
      console.error("Sync error:", err);
      setErrorMsg(err.message || "Could not sync plan status.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    if (!selectedOrg) return;
    setErrorMsg(null);
    setLoadingPlan("portal");

    try {
      const res = await fetch("/api/subscription/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug: selectedOrg.slug,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No billing portal URL returned");
      }
    } catch (err: any) {
      console.error("Portal error:", err);
      setErrorMsg(err.message || "Could not load billing portal.");
      setLoadingPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!selectedOrg) return;
    if (!window.confirm(`Cancel your ${selectedOrg.plan.toUpperCase()} plan? You'll keep access until the end of your billing period.`)) return;
    setLoadingPlan("cancel");
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug: selectedOrg.slug }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to cancel subscription");
      }
      setHasCanceled(true);
      router.refresh();
    } catch (err: any) {
      console.error("Cancel error:", err);
      setErrorMsg(err.message || "Could not cancel subscription.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--rule)]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)]">
            Pricing, Upgrades & Earnings
          </h1>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Review performance and aggregate revenue across all your restaurants, and upgrade subscription tiers.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {accessDeniedOrgName && (
        <div className="p-4 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs">
          <p className="font-semibold mb-1">Access Restricted</p>
          <p>This account is configured as staff for "{accessDeniedOrgName}". Please sign in with the owner account to manage pricing and upgrades.</p>
        </div>
      )}

      {/* ── Section 1: Multi-Restaurant Performance Dashboard ──────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[var(--ink)] flex items-center gap-2">
            <span>📊</span> Multi-Restaurant Performance Overview
          </h2>
          <span className="text-xs font-mono text-[var(--ink-faint)]">
            {orgs.length} {orgs.length === 1 ? "Restaurant" : "Restaurants"} Managed
          </span>
        </div>

        {/* Aggregate KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="ticket p-4 border border-[var(--rule)] bg-[var(--paper-raised)]">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Total Revenue</p>
            <p className="font-display text-2xl font-bold text-[var(--accent)] mt-1">
              AED {totalCombinedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-[var(--ink-soft)] mt-0.5">Across all locations</p>
          </div>

          <div className="ticket p-4 border border-[var(--rule)] bg-[var(--paper-raised)]">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Completed Orders</p>
            <p className="font-display text-2xl font-bold text-[var(--ink)] mt-1">
              {totalCombinedOrders.toLocaleString()}
            </p>
            <p className="text-[10px] text-[var(--ink-soft)] mt-0.5">Paid transactions</p>
          </div>

          <div className="ticket p-4 border border-[var(--rule)] bg-[var(--paper-raised)]">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Total Bookings</p>
            <p className="font-display text-2xl font-bold text-[var(--ink)] mt-1">
              {totalCombinedBookings.toLocaleString()}
            </p>
            <p className="text-[10px] text-[var(--ink-soft)] mt-0.5">Active reservations</p>
          </div>

          <div className="ticket p-4 border border-[var(--rule)] bg-[var(--paper-raised)]">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">Active Tables</p>
            <p className="font-display text-2xl font-bold text-[var(--ink)] mt-1">
              {totalCombinedTables.toLocaleString()}
            </p>
            <p className="text-[10px] text-[var(--ink-soft)] mt-0.5">Managed floor spots</p>
          </div>
        </div>

        {/* Per-Restaurant Breakdown Table */}
        <div className="ticket border border-[var(--rule)] bg-[var(--paper-raised)] overflow-hidden">
          <div className="p-3.5 border-b border-[var(--rule)] bg-[var(--paper)]">
            <p className="text-xs font-semibold text-[var(--ink)]">Individual Restaurant Performance Breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--rule)] text-[var(--ink-faint)] font-mono text-[10px] uppercase tracking-wider bg-[var(--paper)]/50">
                  <th className="py-2.5 px-4">Restaurant</th>
                  <th className="py-2.5 px-4">Plan Tier</th>
                  <th className="py-2.5 px-4 text-right">Revenue (AED)</th>
                  <th className="py-2.5 px-4 text-right">Paid Orders</th>
                  <th className="py-2.5 px-4 text-right">Bookings</th>
                  <th className="py-2.5 px-4 text-right">Tables</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {orgs.map((org) => {
                  const isSelected = org.id === selectedOrg?.id;
                  return (
                    <tr
                      key={org.id}
                      className={`hover:bg-[var(--paper)]/60 transition-colors ${
                        isSelected ? "bg-[var(--accent)]/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-[var(--ink)]">
                        <div className="flex items-center gap-2.5">
                          {org.logo_url ? (
                            <img
                              src={org.logo_url}
                              alt={org.name}
                              className="w-7 h-7 rounded-full object-cover border border-[var(--rule)]"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-bold text-xs border border-[var(--accent)]/30">
                              {org.name[0]?.toUpperCase() ?? "R"}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-xs leading-none">{org.name}</p>
                            <p className="text-[10px] font-mono text-[var(--ink-faint)] mt-0.5">/{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            org.plan === "max"
                              ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                              : org.plan === "pro"
                              ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30"
                              : "bg-stone-500/15 text-stone-400 border-stone-500/30"
                          }`}
                        >
                          {org.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--ink)]">
                        AED {org.totalEarningsAed.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--ink-soft)]">
                        {org.paidOrdersCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--ink-soft)]">
                        {org.totalBookingsCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--ink-soft)]">
                        {org.totalTablesCount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedOrgId(org.id)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                            isSelected
                              ? "bg-[var(--accent)] text-white font-semibold"
                              : "border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper)]"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Section 2: Plan Upgrade & Tier Selector ─────────────────── */}
      <section className="space-y-6 pt-4 border-t border-[var(--rule)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--ink)] flex items-center gap-2">
              <span>💳</span> Upgrade Plan for: <span className="text-[var(--accent)]">{selectedOrg?.name}</span>
            </h2>
            <p className="text-xs text-[var(--ink-soft)] mt-1">
              Select a restaurant to upgrade, unlock AI features, automated table combining, and high-capacity ordering.
            </p>
          </div>

          {/* Restaurant Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ink-soft)]">Target Restaurant:</span>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="input text-xs py-1.5 px-3 border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] rounded"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.plan.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Plan Notification Bar */}
        {selectedOrg && (
          <div className="ticket p-4 border border-[var(--rule)] bg-[var(--paper)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">✨</span>
              <div>
                <p className="text-xs font-semibold text-[var(--ink)]">
                  {selectedOrg.name} is currently on the{" "}
                  <span className="uppercase text-[var(--accent)] font-bold">{selectedOrg.plan}</span> Plan
                </p>
                <p className="text-[11px] text-[var(--ink-faint)]">
                  Subscription Status: <span className="font-mono">{selectedOrg.subscription_status}</span>
                </p>
              </div>
            </div>

            {(selectedOrg.stripe_customer_id || selectedOrg.subscription_status === "active") && selectedOrg.subscription_status !== "free" && (
              <>
                {!selectedOrg.stripe_subscription_id && (
                  <button
                    type="button"
                    onClick={handleSyncPlan}
                    disabled={loadingPlan === "sync"}
                    className="btn btn-outline text-xs py-1.5 px-3"
                  >
                    {loadingPlan === "sync" ? "Syncing…" : "Sync Plan Status"}
                  </button>
                )}
                {selectedOrg.stripe_subscription_id && (
                  <>
                    <button
                      type="button"
                      onClick={handleManageBilling}
                      disabled={loadingPlan === "portal"}
                      className="btn btn-outline text-xs py-1.5 px-3"
                    >
                      {loadingPlan === "portal" ? "Opening Stripe…" : "Manage Billing & Invoices →"}
                    </button>
                    {selectedOrg.subscription_status !== "canceled" && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={loadingPlan === "cancel"}
                        className="btn btn-outline text-xs py-1.5 px-3 text-rose-500 hover:text-rose-600 border-rose-300 hover:border-rose-400"
                      >
                        {loadingPlan === "cancel" ? "Canceling…" : "Cancel Subscription"}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {hasCanceled && selectedOrg?.currentPeriodEnd && (
          <div className="p-4 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs">
            <p className="font-semibold mb-1">Subscription Canceled</p>
            <p>
              Your subscription has been canceled. You can still use the {selectedOrg.plan.toUpperCase()} plan until{" "}
              <span className="font-mono font-semibold">{new Date(selectedOrg.currentPeriodEnd).toLocaleDateString()}</span>.
              After that date, your plan will switch to Free.
            </p>
          </div>
        )}

        {selectedOrg?.subscription_status === "canceled" && !hasCanceled && (
          <div className="p-4 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs">
            <p className="font-semibold mb-1">Subscription Expired</p>
            <p>
              Your subscription ended on{" "}
              <span className="font-mono font-semibold">{selectedOrg.currentPeriodEnd ? new Date(selectedOrg.currentPeriodEnd).toLocaleDateString() : "—"}</span>.
              You can still use the <span className="font-semibold">{selectedOrg.plan.toUpperCase()}</span> plan until{" "}
              <span className="font-mono font-semibold">{selectedOrg.currentPeriodEnd ? new Date(selectedOrg.currentPeriodEnd).toLocaleDateString() : "—"}</span>.
            </p>
          </div>
        )}

        {/* Pricing Tier Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pro Tier Card */}
          <div
            className={`ticket p-6 border rounded-lg flex flex-col justify-between transition-all bg-[var(--paper-raised)] ${
              selectedOrg?.plan === "pro"
                ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20 shadow-md"
                : "border-[var(--rule)] hover:border-stone-500"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[var(--ink)]">Pro Plan</h3>
                  <p className="text-xs text-[var(--ink-soft)]">For growing restaurants & bustling cafes</p>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
                  Popular
                </span>
              </div>

              <div className="flex items-baseline gap-1 py-2 border-y border-[var(--rule)]">
                <span className="font-display text-3xl font-bold text-[var(--ink)]">
                  AED {PLAN_MONTHLY_AED.pro}
                </span>
                <span className="text-xs text-[var(--ink-faint)]">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-[var(--ink-soft)]">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Unlimited digital menu & QR table orders</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Live table management & booking windows</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Kitchen Display System (KDS) & Order ticketing</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Custom theme colors & public storefront branding</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Multi-staff roles (Owners, Waiters, Kitchen)</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[var(--rule)]">
              {selectedOrg?.plan === "pro" ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded text-xs font-semibold bg-[var(--paper)] text-[var(--ink-faint)] border border-[var(--rule)] cursor-default"
                >
                  ✓ Current Plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpgrade("pro")}
                  disabled={Boolean(loadingPlan)}
                  className="w-full py-2.5 px-4 rounded text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95 transition-all shadow-xs disabled:opacity-50"
                >
                  {loadingPlan === "pro" ? "Redirecting to Stripe…" : `${selectedOrg?.plan === "max" ? "Switch" : "Upgrade"} ${selectedOrg?.name ?? "Restaurant"} to Pro →`}
                </button>
              )}
            </div>
          </div>

          {/* Max Tier Card */}
          <div
            className={`ticket p-6 border rounded-lg flex flex-col justify-between transition-all bg-[var(--paper-raised)] ${
              selectedOrg?.plan === "max"
                ? "border-purple-500 ring-2 ring-purple-500/20 shadow-md"
                : "border-[var(--rule)] hover:border-purple-400"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[var(--ink)]">Max Plan</h3>
                  <p className="text-xs text-[var(--ink-soft)]">For enterprise restaurants & multi-location groups</p>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  Full Power
                </span>
              </div>

              <div className="flex items-baseline gap-1 py-2 border-y border-[var(--rule)]">
                <span className="font-display text-3xl font-bold text-[var(--ink)]">
                  AED {PLAN_MONTHLY_AED.max}
                </span>
                <span className="text-xs text-[var(--ink-faint)]">/ month</span>
              </div>

              <ul className="space-y-2.5 text-xs text-[var(--ink-soft)]">
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span className="font-semibold text-[var(--ink)]">Everything in Pro included</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>AI Chatbot Voice & Text Reservations</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>Smart multi-table auto-combining optimization</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>Unified multi-restaurant performance dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span>
                  <span>Dedicated priority 24/7 technical onboarding</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[var(--rule)]">
              {selectedOrg?.plan === "max" ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded text-xs font-semibold bg-[var(--paper)] text-[var(--ink-faint)] border border-[var(--rule)] cursor-default"
                >
                  ✓ Current Plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpgrade("max")}
                  disabled={Boolean(loadingPlan)}
                  className="w-full py-2.5 px-4 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xs disabled:opacity-50"
                >
                  {loadingPlan === "max" ? "Redirecting to Stripe…" : `${selectedOrg?.plan === "pro" ? "Upgrade" : "Switch"} ${selectedOrg?.name ?? "Restaurant"} to Max →`}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
