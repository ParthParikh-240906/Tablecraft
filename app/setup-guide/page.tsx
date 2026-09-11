import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function SetupGuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const startHref = user ? "/dashboard" : "/signin?next=/signup";

  const steps = [
    {
      num: "1",
      title: "Create your restaurant",
      lines: [
        "Sign in to Tablecraft and create your restaurant with a name, tagline, and short description.",
        "Choose a public URL and upload your logo — your place on Tablecraft is ready in minutes.",
      ],
    },
    {
      num: "2",
      title: "Design it in the console",
      lines: [
        "Open the console and make it yours: pick themes and colours, add photos, and write your story.",
        "The AI content generator can write your About section from a single sentence.",
      ],
    },
    {
      num: "3",
      title: "Scan your menu",
      lines: [
        "Snap a photo of your printed or chalkboard menu — the AI scanner pulls dishes, prices, and descriptions straight into your database.",
        "Customers see a clean, digital menu on your website.",
      ],
    },
    {
      num: "4",
      title: "Set up your tables",
      lines: [
        "Add your floor plan, tables, and seating layout in the console so reservations and waitlist management work out of the box.",
        "Each table can have a unique name, capacity, and status — your staff sees everything in real time.",
      ],
    },
    {
      num: "5",
      title: "Make payment and go live",
      lines: [
        "Pay the one-time setup fee plus a monthly subscription to unlock your real hosted website with a custom domain.",
        "Share your live link, start taking bookings, and your restaurant is officially online.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="layer2-bg border border-white/20 mx-8 md:mx-16 mt-8 mb-12 rounded-sm">
        <div className="relative">
          <div className="max-w-3xl mx-auto px-6 py-16">
        {/* ─── Back ───────────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-sans tracking-widest uppercase font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <h1 className="font-display text-3xl mb-3">Setup guide</h1>
        <p className="text-[var(--ink-soft)] mb-14 leading-relaxed max-w-lg">
          Five steps from sign-up to a live restaurant website. Each step is
          quick — most restaurants finish the whole process in an afternoon.
        </p>

        {/* ─── Steps ─────────────────────────────────────────────────────────── */}
        <div className="space-y-12">
          {steps.map((step) => (
            <div key={step.num} className="ticket p-6 sm:p-8 relative">
              <div className="absolute -top-4 -left-3 w-9 h-9 rounded-full bg-[var(--accent)] text-white font-display text-sm flex items-center justify-center shadow-lg shadow-orange-950/30">
                {step.num}
              </div>
              <h2 className="font-display text-lg mb-2 mt-1">{step.title}</h2>
              {step.lines.map((line, i) => (
                <p
                  key={i}
                  className="text-sm text-[var(--ink-soft)] leading-relaxed"
                >
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>

        {/* ─── CTA ───────────────────────────────────────────────────────────── */}
        <div className="mt-14 text-center">
          <Link href={startHref} className="btn btn-accent text-sm px-8 py-3">
            Get started →
          </Link>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}