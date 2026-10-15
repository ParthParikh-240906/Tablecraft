import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Tablecraft",
  description: "Tablecraft privacy policy.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-[17px] text-neutral-600 leading-[1.6] mb-5">
          Tablecraft collects the minimum data needed to run your restaurant
          website: account details, restaurant content you publish, and
          reservation information guests submit on your pages.
        </p>
        <p className="text-[17px] text-neutral-600 leading-[1.6] mb-5">
          We do not sell personal data. Analytics, if enabled, are aggregated
          and used only to improve the service. Contact us via the homepage
          contact form with any privacy questions or deletion requests.
        </p>
        <p className="text-[15px] text-neutral-400 leading-relaxed">
          Last updated 2026.
        </p>
      </div>
    </div>
  );
}
