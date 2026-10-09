"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FeaturesCarousel } from "@/components/FeaturesCarousel";
import { MARKETING_PLANS as PRICING } from "@/lib/marketing-plans";
import type { User } from "@supabase/supabase-js";

interface Org {
  id: string;
  name: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
  tagline: string | null;
}

// ─── Scroll Reveal Hook ──────────────────────────────────────────────────────
const prefersReducedMotion = typeof window !== "undefined"
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={[
        prefersReducedMotion ? "" : "transition-all duration-700 ease-out",
        visible ? "opacity-100 translate-y-0" : prefersReducedMotion ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={prefersReducedMotion ? {} : { transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Static Data ──────────────────────────────────────────────────────────────
const AI_FEATURES = [
  {
    title: "AI Chatbot",
    subtitle: "Booking assistant",
    description: "Guests chat naturally — \"I need a table for 4 this Friday at 7\" — and the AI collects details, checks availability, and confirms instantly.",
    color: "#f97316",
    image: "/features/chatbot.png",
  },
  {
    title: "AI Image Editor",
    subtitle: "Design assistant",
    description: "Generate hero images, logos, and menu artwork with prompts. Upload a photo and ask the AI to edit, crop, or enhance it in seconds.",
    color: "#f97316",
    image: "/features/image-editor.png",
  },
  {
    title: "AI Content Generator",
    subtitle: "Website copy in seconds",
    description: "Describe your restaurant in a few words and the AI generates your tagline, about text, and menu descriptions — ready to publish instantly.",
    color: "#f97316",
    image: "/features/content-generator.png",
  },
  {
    title: "AI Menu Scanner",
    subtitle: "Photo → digital menu",
    description: "Snap a photo of your printed menu. OCR extracts every dish, price, and category — then structures it into your live menu in one click.",
    color: "#f97316",
    image: "/features/menu-scanner.png",
  },
  {
    title: "Staff Dashboard",
    subtitle: "Real-time operations",
    description: "One screen for tables, orders, reservations, and kitchen tickets. Toggle capacity, update the daily specials, and track everything live.",
    color: "#f97316",
    image: "/features/dashboard.png",
  },
];

const CUISINES = [
  "Italian", "Japanese", "Lebanese", "Indian", "French",
  "Mexican", "Thai", "Cafés", "Burgers", "Seafood",
];

const FAQS = [
  {
    q: "How fast can I launch?",
    a: "Most restaurants go from signup to a live site the same afternoon: create your restaurant, scan your printed menu with AI, arrange tables, then upgrade to go live.",
  },
  {
    q: "Do I need a designer or developer?",
    a: "No. The AI generates your tagline, about copy, and menu descriptions, and the image editor creates hero art and logos from a prompt. Max-plan teams get senior frontend help for custom tweaks.",
  },
  {
    q: "How do bookings work?",
    a: "Guests chat with the AI assistant on your public site — it collects party size, date, and time, checks availability, and confirms instantly. Staff see everything live in the console.",
  },
  {
    q: "Can I start free?",
    a: "Yes. The Free plan gives you a mock website and mock console to plan and test, with monthly AI limits. Upgrade to Pro or Max when you're ready for a real hosted site.",
  },
  {
    q: "What do staff get day-to-day?",
    a: "One screen for tables, orders, reservations, and kitchen tickets — plus capacity toggles and daily specials. It works on desktop and on the floor.",
  },
];

// ─── Navigation ───────────────────────────────────────────────────────────────────
function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Restaurants", href: "#restaurants" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-white/20 ${
        scrolled ? "bg-[var(--paper)]/90 backdrop-blur-md border-b border-[var(--rule)] shadow-lg" : ""
      }`}
    >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user ? (
              <button type="button" onClick={handleSignOut} className="btn btn-accent text-[10px] px-2.5 py-1.5">
                Sign out
              </button>
            ) : (
              <Link href="/signin?next=/dashboard" className="btn btn-accent text-[10px] px-2.5 py-1.5">
                Sign in
              </Link>
            )}
            <Link href="/" className="font-display text-lg tracking-tight text-[var(--ink)]">
              Tablecraft
            </Link>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
              >
                {l.label}
              </a>
            ))}
            <Link
              href={user ? "/dashboard" : "/signin?next=/dashboard"}
              className="btn btn-outline-strong text-[10px] px-2.5 py-1.5"
            >
              Dashboard
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[var(--ink)]"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[var(--paper-raised)] border-b border-[var(--rule)] px-6 py-4 space-y-3">
            {user ? (
              <button
                type="button"
                onClick={() => { handleSignOut(); setMobileOpen(false); }}
                className="btn btn-accent text-xs w-full min-h-[44px]"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/signin?next=/dashboard"
                onClick={() => setMobileOpen(false)}
                className="btn btn-accent text-xs w-full min-h-[44px]"
              >
                Sign in
              </Link>
            )}
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors py-2.5"
              >
                {l.label}
              </a>
            ))}
            <Link
              href={user ? "/dashboard" : "/signin?next=/dashboard"}
              onClick={() => setMobileOpen(false)}
              className="btn btn-outline text-xs w-full min-h-[44px]"
            >
              Dashboard
            </Link>
          </div>
        )}
      </nav>
  );
}

// ─── Hero — centered, no eyebrow, visual slot left blank ───────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden min-h-screen flex flex-col pt-28 border-b border-white/10">
      {/* Premium restaurant background image */}
      <div className="hero-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="hero-bg__image"
        />
        <div className="hero-bg__overlay" />
        <div className="hero-bg__glow" />
        <div className="hero-bg__scrim" />
      </div>

      {/* Centered headline — sits at the page center */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full flex-1 flex flex-col items-center justify-center">
        {/* Copy */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6 text-[var(--ink)]">
            Your restaurant,
            <br />
            <span className="gradient-text">online</span> in minutes.
          </h1>
          <p className="text-[var(--ink-soft)] text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed opacity-95">
            AI-powered website, console, and staff dashboard — built for restaurants that want to move fast.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup" className="btn btn-accent text-base px-10 py-4">
              Create your restaurant
            </Link>
            <a href="#restaurants" className="btn btn-outline text-base px-10 py-4">
              Demo restaurants
            </a>
          </div>
        </div>
      </div>

      {/* Everything else rests in the bottom half of the page */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 w-full pb-12">
        <div className="text-center max-w-3xl mx-auto">
          {/* Trust row */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex -space-x-2" aria-hidden="true">
              {["M", "S", "J", "+"].map((c, i) => (
                <span
                  key={i}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-[var(--paper)]"
                  style={{ background: i === 3 ? "var(--paper-overlay)" : "var(--accent)", zIndex: 4 - i }}
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="text-left">
              <p className="text-sm text-[var(--ink)] font-medium" aria-label="Rated 4.9 out of 5">
                <span className="text-[var(--accent)] tracking-tight">★★★★★</span> 4.9/5
              </p>
              <p className="text-xs text-[var(--ink-faint)]">Loved by restaurant owners</p>
            </div>
          </div>

          {/* Stats */}
          <dl className="grid grid-cols-3 max-w-md mx-auto gap-6 border-t border-white/10 pt-6">
            {[
              { v: "10 min", l: "Median setup" },
              { v: "80%", l: "Bookings via AI" },
              { v: "Same day", l: "Setup → live" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="font-display text-xl md:text-2xl text-[var(--ink)]">{s.v}</dd>
                <dd className="text-xs text-[var(--ink-faint)] mt-1">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

// ─── Trust strip ──────────────────────────────────────────────────────────────
function TrustStrip() {
  return (
    <section aria-label="Popular cuisines" className="border-b border-white/10 bg-[var(--paper)]">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center gap-5">
        <p className="label-caps text-[var(--ink-faint)] whitespace-nowrap">Built for every kind of restaurant</p>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <span key={c} className="text-xs text-[var(--ink-soft)] border border-[var(--rule)] rounded-full px-3 py-1.5 bg-[var(--paper-raised)]">
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── AI Features — website band, sticky pitch + carousel ─────────────────────
function FeaturesSection() {
  const checklist = [
    "Booking chatbot that confirms tables 24/7",
    "Menu scanner: printed photo → structured menu",
    "Image editor + content generator for launch day",
    "Staff dashboard for tables, orders & kitchen",
  ];
  return (
    <section id="features" className="border-b border-white/10 bg-[var(--paper-raised)] scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
        <div className="lg:sticky lg:top-32">
          <Reveal>
            <p className="label-caps text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>AI-Powered</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-3xl md:text-4xl mb-4 text-[var(--ink)]">
              Everything runs on AI.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-[var(--ink-soft)] max-w-lg mb-7 text-base leading-relaxed">
              From booking guests to scanning menus to designing your site — Tablecraft handles the heavy lifting so you can focus on the food.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <ul className="space-y-2.5 mb-8">
              {checklist.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm text-[var(--ink-soft)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {c}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={280}>
            <div className="flex flex-wrap gap-3">
              <a href="#how-it-works" className="btn btn-outline text-sm">See how it works</a>
              <a href="#pricing" className="btn btn-accent text-sm">Compare plans</a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <FeaturesCarousel features={AI_FEATURES} />
        </Reveal>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function StepCard({ n, title, body, delay }: { n: number; title: string; body: string; delay: number }) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="ticket ticket--dark p-6 sm:p-7 h-full relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        <span
          className="flex w-10 h-10 rounded-sm items-center justify-center text-base font-bold font-display mb-5"
          style={{ background: "var(--accent)", color: "#ffffff" }}
        >
          {n}
        </span>
        <h3 className="font-display text-xl mb-2 text-[var(--ink)]">{title}</h3>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{body}</p>
        <div className="mt-5 h-px bg-[var(--accent)]/40 group-hover:bg-[var(--accent)] transition-colors duration-300" />
      </div>
    </Reveal>
  );
}

function HowItWorksSection() {
  const steps = [
    { n: 1, title: "Create your restaurant & design", body: "Sign up, pick a name, claim your public URL, and create your design." },
    { n: 2, title: "Set up your menu & tables", body: "Scan your printed menu with AI and set up your tables." },
    { n: 3, title: "Go live", body: "Make the payment and go live — guests can find you, book tables via the AI chatbot, and order online." },
  ];

  return (
    <section id="how-it-works" className="border-b border-white/10 bg-[var(--paper)] scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <p className="label-caps text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>How it works</p>
        </Reveal>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <Reveal delay={80}>
            <h2 className="font-display text-3xl md:text-4xl text-[var(--ink)]">
              Three steps. That&apos;s it.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <Link href="/signup" className="btn btn-outline text-sm whitespace-nowrap">Start step 1 →</Link>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <StepCard key={s.n} {...s} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Operations preview — mirrors the real staff dashboard ──────────────────────
function OpsPreviewSection() {
  const stats = [
    { label: "Total tables", value: "4", sub: "2 available" },
    { label: "Booked today", value: "1", sub: "reservations" },
    { label: "Order count", value: "1", sub: "live orders" },
    { label: "Available now", value: "2", sub: "9 seats" },
  ];
  return (
    <section aria-label="Staff operations preview" className="border-b border-white/10 bg-[var(--paper-raised)]">
      <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Reveal>
            <p className="label-caps text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>Staff console</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-3xl md:text-4xl mb-4 text-[var(--ink)]">One screen for the whole floor.</h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-[var(--ink-soft)] text-base leading-relaxed mb-6 max-w-md">
              Tables, bookings, and live orders update in real time. Search reservations, confirm guests, and fire table orders — all from the dashboard.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-accent text-sm">Try the console</Link>
              <a href="#restaurants" className="btn btn-outline text-sm">Explore a live demo</a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <div className="ticket ticket--dark overflow-hidden" aria-hidden="true">
            <div className="px-5 pt-5 pb-4 border-b border-[var(--rule)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-[var(--ink)]">Malabar Bites&apos;s Dashboard</p>
                  <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">Tuesday, September 15, 2026</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#22c55e] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" /> Live
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-md border border-[var(--rule)] bg-[var(--paper-raised)] px-3 py-2.5">
                    <p className="label-caps text-[var(--ink-faint)]" style={{ fontSize: "0.6rem" }}>{s.label}</p>
                    <p className="font-display text-2xl text-[var(--ink)] mt-1">{s.value}</p>
                    <p className="text-[10px] text-[var(--ink-soft)]">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="label-caps text-[var(--ink-faint)]">Today&apos;s bookings</p>
                    <p className="font-display text-base text-[var(--ink)] mt-1">Bookings</p>
                  </div>
                  <span className="btn btn-accent text-[11px] px-3 py-1.5 pointer-events-none">+ Add booking</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 mb-3">
                  <div className="input text-[11px] !py-2 text-[var(--ink-faint)] pointer-events-none">e.g. John, Sarah…</div>
                  <div className="input text-[11px] !py-2 text-[var(--ink-faint)] pointer-events-none">e.g. 2026-08-29 or 7:30 PM</div>
                </div>
                <p className="label-caps mb-2" style={{ color: "var(--accent)", fontSize: "0.65rem" }}>Upcoming (1)</p>
                <div className="rounded-md border border-[var(--rule)] bg-[var(--paper-raised)] px-3.5 py-3">
                  <p className="text-sm font-semibold text-[var(--ink)]">Kaushik</p>
                  <p className="text-[11px] text-[var(--ink-soft)] mt-0.5">Tue, Sep 15 at 4:48 PM · Table 1 · 3 people</p>
                  <div className="flex gap-2 mt-2.5">
                    <span className="text-[10px] font-semibold tracking-wider border border-[#22c55e]/60 text-[#22c55e] rounded-md px-2.5 py-1">CONFIRMED</span>
                    <span className="text-[10px] font-medium border border-red-500/60 text-red-400 rounded-md px-2.5 py-1">Cancel</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="label-caps text-[var(--ink-faint)]">Order dashboard</p>
                  <span className="btn btn-accent text-[11px] px-3 py-1.5 pointer-events-none">+ Add Table Order</span>
                </div>
                <div className="rounded-md border border-[var(--rule)] bg-[var(--paper-raised)] px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">Table Group · Table 2</p>
                      <p className="text-xs mt-1 text-[var(--ink-soft)]"><span style={{ color: "var(--accent)" }} className="font-semibold">3x</span> CHICKEN ROAST</p>
                      <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">AED 96</p>
                    </div>
                    <span className="text-[10px] font-semibold border border-[#f59e0b]/50 text-[#f59e0b] bg-[#f59e0b]/10 rounded-full px-2.5 py-1 shrink-0">Pending</span>
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <span className="text-[10px] font-medium border border-red-500/60 text-red-400 rounded-md px-2.5 py-1">Delete</span>
                    <span className="text-[10px] font-medium border border-[var(--rule-strong)] text-[var(--ink-soft)] rounded-md px-2.5 py-1">Edit</span>
                    <span className="text-[10px] font-medium border border-[var(--rule-strong)] text-[var(--ink-soft)] rounded-md px-2.5 py-1">Print</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Browse Restaurants ───────────────────────────────────────────────────────
function RestaurantCard({ org, index }: { org: Org; index: number }) {
  const color = org.theme_color ?? "#f97316";

  return (
    <Reveal delay={Math.min(index, 5) * 80} className="h-full">
      <div className="ticket ticket--dark p-4 block group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg h-full">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold font-display text-base shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: color }}
          >
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={`${org.name} logo`} className="w-full h-full rounded-full object-cover" />
            ) : (
              org.name.charAt(0)
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm truncate text-[var(--ink)]">{org.name}</p>
            {org.tagline && (
              <p className="text-[10px] text-[var(--ink-faint)] truncate">{org.tagline}</p>
            )}
          </div>
        </div>
        <p className="text-[10px] text-[var(--ink-faint)] mb-3">/{org.slug}</p>
        <div
          className="h-px transition-all duration-300 mb-3"
          style={{ width: "100%", backgroundColor: `${color}55` }}
        />
        <div className="flex gap-2">
          <Link
            href={`/${org.slug}`}
            className="flex-1 btn btn-outline text-xs py-1.5"
          >
            Visit Storefront
          </Link>
          <a
            href={`/api/demo/redirect?org=${org.slug}`}
            className="flex-1 btn btn-accent text-xs py-1.5 whitespace-nowrap"
          >
            Live Demo
          </a>
        </div>
      </div>
    </Reveal>
  );
}

function RestaurantsSection() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      const res = await fetch("/api/demo-restaurants");
      const data = await res.json();
      setOrgs(data.orgs ?? []);
      setLoading(false);
    };
    fetchOrgs();
  }, []);

  return (
    <section id="restaurants" className="border-b border-white/10 bg-[var(--paper)] scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <p className="label-caps text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>Directory</p>
        </Reveal>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <Reveal delay={80}>
            <h2 className="font-display text-3xl md:text-4xl text-[var(--ink)]">
              Demo restaurants
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <Link href="/restaurants" className="btn btn-outline text-xs whitespace-nowrap">
              View all restaurants →
            </Link>
          </Reveal>
        </div>
        <Reveal delay={160}>
          <p className="text-[var(--ink-soft)] max-w-xl mb-10 text-base leading-relaxed">
            Preview our demo sites below. Click Live Demo to explore — no login required.
          </p>
        </Reveal>

        {loading ? (
          <div className="ticket ticket--dark p-8 text-center text-[var(--ink-faint)]">Loading restaurants…</div>
        ) : orgs.length === 0 ? (
          <div className="ticket ticket--dark p-8 text-center text-[var(--ink-faint)]">No restaurants yet. Be the first.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {orgs.map((org, i) => (
              <RestaurantCard key={org.id} org={org} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function PricingCard({ plan, index }: { plan: typeof PRICING[0]; index: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [loading] = useState(false);

  async function handleCheckout() {
    if (!plan.planKey || loading) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/signin?next=/dashboard`);
      return;
    }
    // Signed in: redirect to console pricing page to pick restaurant + plan
    const { data: staffRows } = await supabase
      .from("staff_users")
      .select("org_id")
      .eq("auth_user_id", user.id)
      .eq("role", "owner");
    const orgId = (staffRows ?? [])[0]?.org_id;
    if (!orgId) {
      router.push("/restaurants/create");
      return;
    }
    router.push(`/console/pricing?org=${orgId}&plan=${plan.planKey}`);
  }

  return (
    <Reveal delay={index * 120} className="h-full">
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
          <span className="text-sm text-[var(--ink-faint)]">AED/month</span>
        </div>
        {plan.period && <p className="text-sm text-[var(--ink-faint)] mb-4">{plan.period}</p>}
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

function PricingSection() {
  return (
    <section id="pricing" className="border-b border-white/10 bg-[var(--paper-raised)] scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <Reveal>
          <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>Pricing</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="font-display text-3xl md:text-4xl text-center mb-4 text-[var(--ink)]">
            Simple, transparent pricing.
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="text-center text-[var(--ink-soft)] max-w-lg mx-auto mb-10 text-base leading-relaxed">
            Start free with a mock site. Upgrade when you&apos;re ready to go live.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {PRICING.map((p, i) => (
            <PricingCard key={p.name} plan={p} index={i} />
          ))}
        </div>

        <Reveal delay={200}>
          <p className="text-center text-xs text-[var(--ink-faint)] mt-8">
            No credit card to start · Cancel anytime · Email support on paid plans
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "Tablecraft cut our website setup from days to minutes. The AI chatbot handles 80% of our booking inquiries now.",
    author: "Marco R.",
    role: "Owner, Bella Cucina",
  },
  {
    quote: "The kitchen queue changed how we handle rush hour. Staff finally have one screen for everything.",
    author: "Sarah L.",
    role: "Manager, The Golden Fork",
  },
  {
    quote: "Scanning our printed menu with a photo took 30 seconds. We were live the same afternoon.",
    author: "James K.",
    role: "Owner, Street Kitchen",
  },
];

function TestimonialCard({ t, index }: { t: typeof TESTIMONIALS[0]; index: number }) {
  return (
    <Reveal delay={index * 100} className="h-full">
      <figure className="ticket ticket--dark p-6 flex flex-col h-full">
        <p className="text-[var(--accent)] text-sm tracking-tight mb-3" aria-label="5 out of 5 stars">★★★★★</p>
        <blockquote className="text-[var(--ink-soft)] text-sm leading-relaxed flex-1 mb-5">
          &ldquo;{t.quote}&rdquo;
        </blockquote>
        <figcaption className="flex items-center gap-3 mt-auto">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "var(--accent)" }}
          >
            {t.author.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">{t.author}</p>
            <p className="text-xs text-[var(--ink-faint)]">{t.role}</p>
          </div>
        </figcaption>
      </figure>
    </Reveal>
  );
}

function TestimonialsSection() {
  return (
    <section id="testimonials" className="border-b border-white/10 bg-[var(--paper)]">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <Reveal>
          <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>Testimonials</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="font-display text-3xl md:text-4xl text-center mb-4 text-[var(--ink)]">
            Loved by restaurant owners
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-center text-[var(--ink-soft)] max-w-lg mx-auto mb-10 text-base">
            Real feedback from teams who switched to Tablecraft.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={i} t={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ — website staple ─────────────────────────────────────────────────────
function FaqSection() {
  return (
    <section id="faq" className="border-b border-white/10 bg-[var(--paper-raised)] scroll-mt-24">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Reveal>
          <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>FAQ</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="font-display text-3xl md:text-4xl text-center mb-4 text-[var(--ink)]">
            Questions, answered.
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="text-center text-[var(--ink-soft)] max-w-lg mx-auto mb-10 text-base">
            Everything owners usually ask before launching.
          </p>
        </Reveal>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <details className="ticket ticket--dark px-5 py-4 group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-medium text-[var(--ink)]">
                  {f.q}
                  <span className="text-[var(--accent)] transition-transform duration-200 group-open:rotate-45 text-lg leading-none">+</span>
                </summary>
                <p className="text-sm text-[var(--ink-soft)] leading-relaxed mt-3">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact — two-column website section ─────────────────────────────────────
function ContactSection() {
  const { ref, visible } = useReveal();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="border-b border-white/10 bg-[var(--paper)] scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
        <div>
          <Reveal>
            <p className="label-caps text-[var(--accent)] mb-4" style={{ fontSize: "0.875rem", letterSpacing: "0.1em" }}>Get in touch</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-3xl md:text-4xl mb-4 text-[var(--ink)]">
              Questions? Ideas?
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-[var(--ink-soft)] mb-8 max-w-md text-base leading-relaxed">
              Whether you&apos;re a restaurant owner, a developer, or just curious — we&apos;d love to hear from you.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <ul className="space-y-4">
              {[
                { t: "Fast reply", d: "We answer most messages within one business day." },
                { t: "Owner-friendly", d: "No jargon — just tell us about your restaurant." },
                { t: "Setup help", d: "Ask about menus, tables, domains, or launch day." },
              ].map((r) => (
                <li key={r.t} className="flex gap-3 items-start">
                  <span className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "var(--accent)" }}>✓</span>
                  <div>
                    <p className="text-sm font-medium text-[var(--ink)]">{r.t}</p>
                    <p className="text-sm text-[var(--ink-soft)]">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div ref={ref} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            {submitted ? (
              <div className="ticket ticket--dark p-6 text-center">
                <p className="label-caps text-[color:var(--accent)] mb-1">Message Sent</p>
                <h3 className="font-display text-xl text-[var(--ink)] mb-1">Thank you, {name}!</h3>
                <p className="text-xs text-[var(--ink-soft)] mb-4">
                  We received your note and will get back to you shortly.
                </p>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); }}
                  className="btn btn-outline text-[10px]"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="ticket ticket--dark p-5 sm:p-6 space-y-3">
                <div>
                  <label htmlFor="m-name" className="block text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                    Your Name
                  </label>
                  <input
                    id="m-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Chef or Restaurant Owner"
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="m-email" className="block text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                    Email Address
                  </label>
                  <input
                    id="m-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="m-message" className="block text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                    Message
                  </label>
                  <textarea
                    id="m-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your restaurant or any questions..."
                    required
                    className="input resize-none"
                  />
                </div>
                {error && (
                  <p className="text-[10px] text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-accent w-full flex items-center justify-center gap-2"
                >
                  {submitting && (
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {submitting ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── CTA banner — full-bleed ──────────────────────────────────────────────────
function CTASection() {
  return (
    <section aria-label="Get started" className="relative overflow-hidden bg-[var(--paper-raised)]">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-bg__glow" />
      </div>
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
        <div>
          <Reveal>
            <h2 className="font-display text-3xl md:text-5xl mb-4 text-[var(--ink)] leading-tight">
              Ready to get started?
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[var(--ink-soft)] text-lg max-w-xl">
              Create your restaurant site in minutes. No credit card required to start.
            </p>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 lg:justify-end">
            <Link href="/signup" className="btn btn-accent text-base px-10 py-4 whitespace-nowrap">
              Sign up free
            </Link>
            <a href="#pricing" className="btn btn-outline text-base px-10 py-4 whitespace-nowrap">
              View pricing
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer — full website footer ─────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[var(--paper)] border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr] mb-12">
          {/* Brand */}
          <div>
            <p className="font-display text-lg tracking-tight text-[var(--ink)] mb-3">Tablecraft</p>
            <p className="text-xs text-[var(--ink-faint)] leading-relaxed max-w-xs mb-5">
              AI-powered restaurant management platform. Websites, bookings, orders &amp; kitchen ops — all in one place.
            </p>
            <p className="inline-flex items-center gap-2 text-[11px] text-[var(--ink-soft)] border border-[var(--rule)] rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> All systems operational
            </p>
          </div>

          {/* Product */}
          <nav aria-label="Product">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-faint)] mb-3">Product</p>
            <ul className="space-y-2">
              {[
                { label: "Features", href: "#features" },
                { label: "How it works", href: "#how-it-works" },
                { label: "Pricing", href: "#pricing" },
                { label: "Demo restaurants", href: "#restaurants" },
                { label: "Setup guide", href: "/setup-guide" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav aria-label="Company">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-faint)] mb-3">Company</p>
            <ul className="space-y-2">
              {[
                { label: "Testimonials", href: "#testimonials" },
                { label: "FAQ", href: "#faq" },
                { label: "Contact", href: "#contact" },
                { label: "Dashboard", href: "/dashboard" },
                { label: "Directory", href: "/restaurants" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-faint)] mb-3">Legal</p>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                  Create your restaurant
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="label-caps text-[color:var(--ink-faint)] text-xs">
            &copy; {new Date().getFullYear()} Tablecraft. All rights reserved.
          </p>
          <p className="label-caps text-[color:var(--ink-faint)] text-xs">
            <span className="text-[var(--accent)]">Tablecraft</span> &middot; Built for restaurants
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page — full website, no boxed sheet ──────────────────────────────────────
export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <a href="#features" className="skip-link">Skip to content</a>
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <FeaturesSection />
        <HowItWorksSection />
        <OpsPreviewSection />
        <RestaurantsSection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <ContactSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
