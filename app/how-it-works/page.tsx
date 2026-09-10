import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HowItWorksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const startHref = user ? "/signup" : "/signin?next=/signup";

  const steps = [
    {
      title: "Create your restaurant",
      lines: [
        "Sign in to Tablecraft and set up your restaurant's name, tagline, and a short description.",
        "Choose a public URL and upload your logo — your place on Tablecraft is ready in minutes.",
      ],
    },
    {
      title: "Design it in the console",
      lines: [
        "Open the console and make it yours: pick themes and colours, add photos, and write your story.",
        "The AI content generator can write your About section from a single sentence.",
      ],
    },
    {
      title: "Scan your menu",
      lines: [
        "Snap a photo of your printed or chalkboard menu — the AI scanner pulls dishes, prices, and descriptions straight into your database.",
        "Customers see a clean, digital menu on your website.",
      ],
    },
    {
      title: "Upgrade to Pro and make payment",
      lines: [
        "Pay the one-time setup fee plus a monthly subscription to unlock your real hosted website.",
        "Free plan keeps you on a demo site — upgrade whenever you're ready to go live.",
      ],
    },
    {
      title: "Your website goes live",
      lines: [
        "Share your link and start taking bookings, online orders, and table reservations.",
        "That's it — your restaurant is online.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-sans tracking-widest uppercase font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>

        <h1 className="font-display text-4xl mb-2">How it works</h1>
        <p className="text-sm text-[var(--ink-soft)] mb-10">
          From blank page to live restaurant website in five steps.
        </p>

        <div className="space-y-6">
          {steps.map((s, i) => (
            <section key={s.title} className="ticket p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--accent)] text-white font-bold text-xs shrink-0">
                  {i + 1}
                </span>
                <h2 className="font-display text-xl text-[var(--ink)]">{s.title}</h2>
              </div>
              {s.lines.map((line) => (
                <p key={line} className="text-sm text-[var(--ink-soft)] leading-relaxed mb-2">
                  {line}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href={startHref} className="btn btn-accent text-sm">
            Get started →
          </Link>
        </div>
      </div>
    </div>
  );
}