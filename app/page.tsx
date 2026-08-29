import Link from "next/link";
import { ContactForm } from "./contact-form";

export default function MarketingHomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="px-4 pt-24 pb-20 text-center">
        <div className="max-w-3xl mx-auto animate-[fade-up_600ms_ease-out_both]">
          <p className="label-caps text-[color:var(--ink-soft)] mb-4">
            Tablecraft
          </p>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.02] tracking-tight mb-6">
            Your restaurant,
            <br />
            online in minutes.
          </h1>
          <hr className="rule max-w-[120px] mx-auto mb-6" />
          <p className="text-ink-soft text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Give your restaurant a live website with a real menu, table
            reservations, online ordering, and a staff console to run it all.
            No code required.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn btn-accent">
              Create your restaurant
            </Link>
            <Link href="/restaurants" className="btn btn-outline">
              Browse restaurants
            </Link>
          </div>
        </div>
      </section>

      {/* What it gives you — the four pillars */}
      <section className="max-w-4xl mx-auto px-4 py-20">
        <p className="label-caps text-center text-[color:var(--ink-soft)] mb-3">
          Everything you need
        </p>
        <h2 className="font-display text-3xl md:text-4xl text-center mb-12">
          One platform, four superpowers.
        </h2>

        <div className="grid gap-px bg-[var(--rule)] border border-[var(--rule)] rounded-sm overflow-hidden sm:grid-cols-2">
          <Pillar
            title="A live website"
            body="A public menu and landing page for your restaurant, with your own name, branding, and URL."
          />
          <Pillar
            title="Table reservations"
            body="Guests book a table in seconds. Live availability, no phone calls."
          />
          <Pillar
            title="Online ordering"
            body="Add items to a cart and pay securely at checkout. Your kitchen gets every order."
          />
          <Pillar
            title="Staff console"
            body="Toggle table capacity, manage the menu, and view bookings — all in one place."
          />
        </div>
      </section>

      {/* How it works — ticket-style */}
      <section className="max-w-2xl mx-auto px-4 py-20">
        <p className="label-caps text-center text-[color:var(--ink-soft)] mb-3">
          How it works
        </p>
        <h2 className="font-display text-3xl md:text-4xl text-center mb-10">
          Three steps. That's it.
        </h2>

        <div className="ticket p-8 space-y-6">
          <Step n={1} title="Create your restaurant" body="Sign up, pick a name, and claim your public URL." />
          <hr className="rule-dashed" />
          <Step n={2} title="Set up your menu" body="Add dishes, set prices, and mark what's available today." />
          <hr className="rule-dashed" />
          <Step n={3} title="Go live" body="Guests find you, book tables, and order — you run it from the console." />
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="label-caps text-[color:var(--accent)] mb-3">
          Get in touch
        </p>
        <h2 className="font-display text-3xl md:text-4xl mb-4">
          Questions? Ideas?
        </h2>
        <p className="text-ink-soft mb-8 max-w-md mx-auto">
          We'd love to hear from you — whether you're a restaurant
          owner, a developer, or just curious.
        </p>
        <ContactForm />
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--rule)] py-8 text-center space-y-3">
        <Link href="/console/login" className="text-sm text-[var(--ink-soft)] hover:underline">
          Sign in to your console
        </Link>
        <p className="label-caps text-[color:var(--ink-faint)]">
          Tablecraft · Built for restaurants
        </p>
      </footer>
    </div>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-[var(--paper)] p-8">
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-ink-soft leading-relaxed">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <span
        className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-sm text-sm font-semibold"
        style={{ background: "var(--ink)", color: "var(--paper-raised)" }}
      >
        {n}
      </span>
      <div>
        <h3 className="font-display text-lg mb-1">{title}</h3>
        <p className="text-sm text-ink-soft">{body}</p>
      </div>
    </div>
  );
}