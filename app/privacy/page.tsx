import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Tablecraft",
  description: "Tablecraft privacy policy.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center text-xs tracking-widest uppercase font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors mb-8"
        >
          ← Back home
        </Link>
        <h1 className="font-display text-3xl mb-4">Privacy Policy</h1>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-4">
          Tablecraft collects the minimum data needed to run your restaurant
          website: account details, restaurant content you publish, and
          reservation information guests submit on your pages.
        </p>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-4">
          We do not sell personal data. Analytics, if enabled, are aggregated
          and used only to improve the service. Contact us via the homepage
          contact form with any privacy questions or deletion requests.
        </p>
        <p className="text-sm text-[var(--ink-faint)] leading-relaxed">
          Last updated 2026.
        </p>
      </div>
    </div>
  );
}
