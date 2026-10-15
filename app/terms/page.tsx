import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Tablecraft",
  description: "Tablecraft terms of service.",
};

export default function TermsPage() {
  return (
    <div className="min-h-svh bg-white text-neutral-900 antialiased">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-block text-[15px] font-medium text-neutral-500 hover:text-neutral-900 mb-10"
        >
          ← Back home
        </Link>
        <h1 className="font-display leading-tight mb-6" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
          Terms of Service
        </h1>
        <p className="text-[17px] text-neutral-600 leading-[1.6] mb-5">
          By using Tablecraft you agree to use the platform lawfully and only
          for restaurants and venues you are authorized to represent. You are
          responsible for the accuracy of menus, prices, and availability you
          publish.
        </p>
        <p className="text-[17px] text-neutral-600 leading-[1.6] mb-5">
          Paid plans are billed monthly per restaurant. AI features are subject
          to fair-use limits described on the pricing section. We may suspend
          accounts that abuse the service or violate applicable law.
        </p>
        <p className="text-[15px] text-neutral-400 leading-relaxed">
          Last updated 2026.
        </p>
      </div>
    </div>
  );
}
