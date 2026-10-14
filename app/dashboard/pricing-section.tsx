"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_PLANS } from "@/lib/marketing-plans";
import { BillingToggle } from "@/components/BillingToggle";
import {
  PLAN_ANNUAL_AED,
  PLAN_MONTHLY_AED,
  getAnnualMonthlyEquivalent,
  getAnnualSavings,
  type BillingInterval,
} from "@/lib/pricing";

// Reveal hook — minimal inline version for dashboard (no animation on SSR)
function useReveal(threshold = 0.12) {
  const [visible, setVisible] = useState(false);
  return { ref: null as HTMLDivElement | null, visible };
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { visible } = useReveal();
  return (
    <div
      className={visible ? "opacity-100" : "opacity-100"}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function PricingCard({ plan, index, billing }: { plan: typeof MARKETING_PLANS[0]; index: number; billing: BillingInterval }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
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
  const displayUnit = !paidKey ? "AED" : isAnnual ? "AED/year" : "AED/month";
  const displayPeriod = !paidKey
    ? plan.period
    : isAnnual
      ? `AED ${annualEquivalent}/mo billed annually · Save AED ${savings!.savedAed.toLocaleString()} — 1 month free`
      : `or ${annualAed.toLocaleString()} AED/year with annual billing — 1 month free`;

  return (
    <Reveal delay={index * 120}>
      <div
        className={[
          "ticket ticket--dark p-8 sm:p-10 flex flex-col relative transition-all duration-300 h-full",
          plan.highlighted ? "ring-2 ring-[var(--accent)] shadow-xl" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {plan.highlighted && (
          <p className="label-caps text-xs mb-3" style={{ color: "var(--accent)" }}>Most popular</p>
        )}

        <div className="flex items-center gap-2 mb-2">
          <p className="font-display text-2xl font-bold tracking-tight text-[var(--ink)]">{plan.name}</p>
          {paidKey && isAnnual && savings && (
            <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold leading-none">
              1 month free
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="font-display text-4xl text-[var(--ink)]">{displayPrice}</span>
          <span className="text-sm text-[var(--ink-faint)]">{displayUnit}</span>
        </div>
        {displayPeriod && <p className="text-sm text-[var(--ink-faint)] mb-4">{displayPeriod}</p>}
        <p className="text-base text-[var(--ink-soft)] leading-relaxed mb-6 flex-grow">{plan.description}</p>

        <ul className="space-y-2 mb-8">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        {plan.planKey ? (
          <>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className={[
                "btn w-full text-center transition-all duration-200",
                plan.highlighted ? "btn-accent" : "btn-accent",
              ].join(" ")}
              style={
                hovered && !plan.highlighted
                  ? { opacity: 0.9, transform: "translateY(-1px)" }
                  : {}
              }
            >
              {loading ? "Loading…" : plan.cta}
            </button>
            {error && (
              <p className="text-xs text-red-400 mt-2 text-center" role="alert">
                {error}
              </p>
            )}
          </>
        ) : (
          <Link
            href={plan.ctaLink}
            className={[
              "btn w-full text-center transition-all duration-200",
              plan.highlighted ? "btn-accent" : plan.planKey === null ? "btn-outline-accent" : "btn-outline",
            ].join(" ")}
            style={
              hovered && !plan.highlighted
                ? { opacity: 0.9, transform: "translateY(-1px)" }
                : {}
            }
          >
            {plan.cta}
          </Link>
        )}
      </div>
    </Reveal>
  );
}

export function DashboardPricingSection() {
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  return (
    <section id="pricing">
      <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>Pricing</p>
      <h2 className="font-display text-2xl md:text-3xl text-center mb-4 text-[var(--ink)]">
        Simple, transparent pricing.
      </h2>
      <p className="text-center text-[var(--ink-soft)] max-w-md mx-auto mb-6 text-base">
        Start free with a mock site. Upgrade when you&apos;re ready to go live.
      </p>

      <div className="flex justify-center mb-9">
        <BillingToggle value={billing} onChange={setBilling} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {MARKETING_PLANS.map((p, i) => (
          <PricingCard key={p.name} plan={p} index={i} billing={billing} />
        ))}
      </div>
    </section>
  );
}
