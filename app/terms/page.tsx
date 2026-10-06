import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Tablecraft",
  description: "Tablecraft terms of service.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center text-xs tracking-widest uppercase font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors mb-8"
        >
          ← Back home
        </Link>
        <h1 className="font-display text-3xl mb-4">Terms of Service</h1>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-4">
          By using Tablecraft you agree to use the platform lawfully and only
          for restaurants and venues you are authorized to represent. You are
          responsible for the accuracy of menus, prices, and availability you
          publish.
        </p>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-4">
          Paid plans are billed monthly per restaurant. AI features are subject
          to fair-use limits described on the pricing section. We may suspend
          accounts that abuse the service or violate applicable law.
        </p>
        <p className="text-sm text-[var(--ink-faint)] leading-relaxed">
          Last updated 2026.
        </p>
      </div>
    </div>
  );
}
