"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_PLANS } from "@/lib/marketing-plans";

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

function PricingCard({ plan, index }: { plan: typeof MARKETING_PLANS[0]; index: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (!plan.planKey || loading) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/signin?next=/signup?plan=${plan.planKey}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/one-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.planKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout failed:", data);
        alert(data.error ?? "Failed to start checkout. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Network error. Please try again.");
      setLoading(false);
    }
  }

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

        <p className="label-caps text-xs mb-2 text-[var(--ink-soft)]">{plan.name}</p>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="font-display text-4xl text-[var(--ink)]">{plan.price}</span>
          <span className="text-sm text-[var(--ink-faint)]">AED</span>
        </div>
        <p className="text-sm text-[var(--ink-faint)] mb-4">{plan.period}</p>
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
  return (
    <section id="pricing">
      <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>Pricing</p>
      <h2 className="font-display text-2xl md:text-3xl text-center mb-4 text-[var(--ink)]">
        Simple, transparent pricing.
      </h2>
      <p className="text-center text-[var(--ink-soft)] max-w-md mx-auto mb-9 text-base">
        Start free with a mock site. Upgrade when you&apos;re ready to go live.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {MARKETING_PLANS.map((p, i) => (
          <PricingCard key={p.name} plan={p} index={i} />
        ))}
      </div>
    </section>
  );
}
