"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_PLANS } from "@/lib/marketing-plans";
import {
  PLAN_ANNUAL_AED,
  PLAN_MONTHLY_AED,
  getAnnualMonthlyEquivalent,
  getAnnualSavings,
  type BillingInterval,
} from "@/lib/pricing";

const ACCENT = "#d45200";

function PricingCard({ plan, billing }: { plan: typeof MARKETING_PLANS[0]; billing: BillingInterval }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAnnual = billing === "annual";

  async function handleCheckout() {
    if (!plan.planKey || loading) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.push(`/signin?next=/dashboard`);
        return;
      }
      // Signed in: redirect to console pricing page to pick restaurant + plan
      const { data: staffRows, error: staffError } = await supabase
        .from("staff_users")
        .select("org_id")
        .eq("auth_user_id", user.id)
        .eq("role", "owner");
      if (staffError) {
        setError("Could not load your restaurants — please try again.");
        return;
      }
      const orgId = (staffRows ?? [])[0]?.org_id;
      if (!orgId) {
        router.push("/restaurants/create");
        return;
      }
      router.push(`/console/pricing?org=${orgId}&plan=${plan.planKey}&billing=${billing}`);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const paidKey = plan.planKey;
  const monthlyAed = paidKey ? PLAN_MONTHLY_AED[paidKey] : 0;
  const annualAed = paidKey ? PLAN_ANNUAL_AED[paidKey] : 0;
  const savings = paidKey ? getAnnualSavings(paidKey) : null;
  const annualEquivalent = paidKey ? getAnnualMonthlyEquivalent(paidKey) : 0;
  const displayPrice = !paidKey ? "0" : isAnnual ? `${annualAed}` : `${monthlyAed}`;
  const displayUnit = !paidKey ? "AED" : isAnnual ? "AED / year" : "AED / month";
  const displayNote = !paidKey
    ? plan.period
    : isAnnual
      ? `AED ${annualEquivalent} a month, billed annually. Saves AED ${savings!.savedAed.toLocaleString()}.`
      : `Or AED ${annualAed.toLocaleString()} a year. One month free.`;

  const isPro = plan.name === "Pro";
  const isMax = plan.name === "Max";
  const dark = isPro || isMax;
  const panel = isPro ? "bg-neutral-950 text-white" : isMax ? "text-white" : "bg-neutral-100 text-neutral-950";
  const sub = dark ? "text-neutral-400" : "text-neutral-600";

  return (
    <div
      className={`rounded-3xl p-8 sm:p-9 flex flex-col h-full ${panel}`}
      style={isMax ? { backgroundColor: ACCENT } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-[30px] leading-none">{plan.name}</p>
        {plan.highlighted && (
          <span className={`text-[13px] font-semibold px-3 py-1 rounded-full ${isPro ? "bg-white text-neutral-950" : "bg-white/20 text-white"}`}>
            Most popular
          </span>
        )}
      </div>
      <p className={`text-[16px] leading-[1.6] mt-4 max-w-[30ch] ${sub}`}>{plan.description}</p>
      <p className="mt-8 flex items-baseline gap-2">
        <span className="font-display tabular-nums leading-none text-[64px]">{displayPrice}</span>
        <span className={`text-[16px] ${sub}`}>{displayUnit}</span>
      </p>
      <p className={`text-[14px] mt-2 tabular-nums ${sub}`}>{displayNote}</p>
      <ul className={`mt-7 space-y-2.5 text-[15px] ${sub}`}>
        {plan.features.map((feat) => (
          <li key={feat} className="flex gap-2.5">
            <svg className="shrink-0 mt-[5px]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fff" : ACCENT} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{feat}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-9">
        {plan.planKey ? (
          <>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading}
              className={`w-full text-[16px] font-semibold px-8 py-4 rounded-full transition-colors disabled:opacity-50 ${
                isPro ? "bg-white text-neutral-950 hover:bg-neutral-200" : "bg-neutral-950 text-white hover:bg-neutral-800"
              }`}
            >
              {loading ? "Loading…" : plan.cta}
            </button>
            {error && (
              <p className="text-[14px] text-red-600 mt-3 text-center" role="alert">
                {error}
              </p>
            )}
          </>
        ) : (
          <Link
            href={plan.ctaLink}
            className="block text-center w-full text-[16px] font-semibold px-8 py-4 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 transition-colors"
          >
            {plan.cta}
          </Link>
        )}
      </div>
    </div>
  );
}

export function DashboardPricingSection() {
  const [billing, setBilling] = useState<BillingInterval>("monthly");

  return (
    <section id="pricing" className="scroll-mt-24">
      <h2 className="font-display text-[30px] leading-tight tracking-[-0.02em]">
        Simple, transparent pricing.
      </h2>
      <p className="text-[17px] leading-[1.6] text-neutral-600 mt-3 max-w-[52ch]">
        Start free with a mock site. Upgrade when you&apos;re ready to go live. Annual billing takes a month off.
      </p>

      <div className="inline-flex mt-7 p-1 rounded-full bg-neutral-100" role="group" aria-label="Billing period">
        {(["monthly", "annual"] as BillingInterval[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setBilling(v)}
            aria-pressed={billing === v}
            className={`px-6 py-2.5 text-[15px] font-semibold rounded-full transition-colors ${
              billing === v ? "bg-neutral-950 text-white" : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {v === "annual" ? "Annual · 1 month free" : "Monthly"}
          </button>
        ))}
      </div>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {MARKETING_PLANS.map((p) => (
          <PricingCard key={p.name} plan={p} billing={billing} />
        ))}
      </div>
      <p className="text-center text-[14px] text-neutral-500 pt-8">
        No credit card to start · Cancel anytime · Email support on paid plans
      </p>
    </section>
  );
}
