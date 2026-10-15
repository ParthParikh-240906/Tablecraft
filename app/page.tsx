"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ViewSiteLink } from "@/components/ViewSiteLink";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_PLANS as PRICING } from "@/lib/marketing-plans";
import {
  PLAN_ANNUAL_AED,
  PLAN_MONTHLY_AED,
  getAnnualMonthlyEquivalent,
  getAnnualSavings,
  type BillingInterval,
} from "@/lib/pricing";
import type { User } from "@supabase/supabase-js";

interface Org {
  id: string;
  name: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
  tagline: string | null;
}

const ACCENT = "#d45200";
const ACCENT_DARK = "#b54600";
const INK = "#0a0a0a";

/* ── Reveal on scroll: once, staggered by delay ── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`rv ${visible ? "rv-in" : ""} ${className}`}
      style={{ ["--rvd" as string]: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Data ── */
const FEATURES = [
  {
    id: "create",
    title: "AI Website Builder",
    body: "Tell the AI your name, cuisine, and vibe. It designs your full website — tagline, copy, and theme — in minutes.",
    image: "/features/Website_Create.png",
    alt: "Creating a Tablecraft website with the AI website builder",
  },
  {
    id: "images",
    title: "AI Image Generator",
    body: "Generate hero images, logos, and menu artwork from a prompt, or upload a photo and ask the AI to improve it.",
    image: "/features/image-editor.png",
    alt: "The Tablecraft image studio generating restaurant artwork",
  },
  {
    id: "editor",
    title: "AI Website Editor",
    body: "New headline, different hours, a whole new section. Tell the AI in plain words and the edit lands on your live site in seconds.",
    image: "/features/Website_Edit.png",
    alt: "Editing a Tablecraft website by chatting with the AI",
  },
  {
    id: "scanner",
    title: "AI Menu Scanner",
    body: "Snap your printed menu. OCR lifts every dish, price, and category into a structured digital menu in one click.",
    image: "/features/menu-scanner.png",
    alt: "The Tablecraft menu scanner digitising a printed menu",
  },
  {
    id: "chatbot",
    title: "AI Booking Chatbot",
    body: "“Table for 4 this Friday at 7.” The AI collects the details, checks availability, and confirms instantly, day or night.",
    image: "/features/chatbot.png",
    alt: "The Tablecraft booking chatbot answering a guest",
  },
];

const STEPS = [
  {
    title: "Create your restaurant and design website",
    body: "Sign up, name your restaurant, and let the AI design your site from a few words.",
  },
  {
    title: "Add menu items and tables",
    body: "Scan your printed menu with AI, then set up your tables and floor plan.",
  },
  {
    title: "Make payment and host the website",
    body: "Upgrade and your site goes live, so guests can book and order straight away.",
  },
];

const FAQS = [
  {
    q: "How fast can I launch?",
    a: "Most restaurants go from signup to a live site the same afternoon: create your restaurant, scan your printed menu with AI, arrange tables, then upgrade to go live.",
  },
  {
    q: "Do I need a designer or developer?",
    a: "No. The AI writes your tagline, about copy, and menu descriptions, and the image studio makes hero art and logos from a prompt. Max-plan teams get priority support for custom tweaks.",
  },
  {
    q: "How do bookings work?",
    a: "Guests chat with the AI assistant on your public site. It collects party size, date, and time, checks availability, and confirms instantly. Staff see everything live in the console.",
  },
  {
    q: "Can I start free?",
    a: "Yes. The Free plan gives you a mock website and mock console to plan and test, with monthly AI limits. Upgrade to Pro or Max when you're ready for a real hosted site.",
  },
  {
    q: "What do staff get day-to-day?",
    a: "One screen for tables, orders, reservations, and kitchen tickets, plus capacity toggles and daily specials. It works on desktop and on the floor.",
  },
  {
    q: "Which models power the AI website builder and editor?",
    a: "We use some of the best frontier models, such as Haiku 5.5 and GPT 6.1 Sol, for the AI website builder and edits.",
  },
];

/* ── Hero preview: real product screenshots on a laptop and a phone ── */
function PreviewImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`${className} bg-neutral-200`}
        aria-label={alt}
        role="img"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`${className} xfade`}
      draggable={false}
    />
  );
}

function DevicePreview() {
  const [view, setView] = useState<"site" | "console">("site");
  const views = {
    site: {
      label: "Website",
      src: "/taj-desktop.jpg",
      alt: "Taj Restaurant website on a laptop",
      caption: "Taj Restaurant · live site",
    },
    console: {
      label: "Management console",
      src: "/features/dashboard.png",
      alt: "Tablecraft management console with live tables and orders",
      caption: "Taj Restaurant · live management console",
    },
  } as const;
  const current = views[view];

  return (
    <div className="relative w-full max-w-[600px] mx-auto select-none">
      <div
        className="flex items-center gap-1 mb-4"
        role="group"
        aria-label="Preview"
      >
        {(Object.keys(views) as (keyof typeof views)[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={`text-[14px] font-medium px-4 py-2 rounded-full btn-press border border-black ${
              view === key
                ? "bg-neutral-950 text-white"
                : "bg-neutral-100 text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {views[key].label}
          </button>
        ))}
      </div>

      <div className="relative w-full aspect-[800/489]">
        <div
          className="absolute overflow-hidden bg-black"
          style={{
            left: "9.38%",
            top: "3.89%",
            width: "81.25%",
            height: "85.89%",
          }}
        >
          <PreviewImage
            key={current.src}
            src={current.src}
            alt={current.alt}
            className={`h-full w-full ${view === "console" ? "object-contain" : "object-cover object-top"}`}
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mockups/macbook-frame.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full pointer-events-none"
          draggable={false}
        />

        <div
          className="absolute right-0 -bottom-[6%] float-slow"
          style={{ height: "50%", aspectRatio: "391 / 800" }}
        >
          <div className="relative h-full w-full">
            <div
              className="absolute overflow-hidden rounded-[10%] bg-black"
              style={{
                left: "4.86%",
                top: "1.88%",
                width: "90.54%",
                height: "96.25%",
              }}
            >
              <PreviewImage
                src="/taj-mobile.jpg"
                alt="Taj Restaurant website on a phone"
                className="h-full w-full object-contain"
              />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mockups/iphone-frame.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full pointer-events-none"
              draggable={false}
            />
          </div>
        </div>
      </div>


      <div className="absolute left-3 -bottom-8 flex items-center gap-2 rounded-full bg-white px-3.5 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-green-500 pulse-ring" />
          <span className="relative h-2 w-2 rounded-full bg-green-600" />
        </span>
        <span className="text-[13px] font-medium text-neutral-700">
          {current.caption}
        </span>
      </div>
    </div>
  );
}

/* ── Navigation: wordmark, four links, one action ── */
function Navbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-md shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]"
          : "bg-white"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          onClick={(e) => {
            if (window.location.pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="font-display text-[22px] tracking-tight"
          style={{ color: INK }}
        >
          Tablecraft
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative inline-block py-1 text-[15px] text-neutral-600 hover:text-neutral-950 transition-colors"
            >
              {l.label}
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full bg-[#d45200] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
              />
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-1">
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="text-[15px] font-medium px-4 py-2.5 text-neutral-600 hover:text-neutral-950"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/signin?next=/dashboard"
              className="text-[15px] font-medium px-4 py-2.5 text-neutral-600 hover:text-neutral-950"
            >
              Sign in
            </Link>
          )}
          <Link
            href={user ? "/dashboard" : "/signup"}
            className="btn-accent text-[15px] font-semibold px-5 py-2.5 rounded-full btn-press"
          >
            {user ? "Dashboard" : "Get started"}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-neutral-950"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-white px-6 pb-6 pt-2">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block text-[17px] text-neutral-800 py-3"
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-3">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  handleSignOut();
                  setMobileOpen(false);
                }}
                className="flex-1 text-[15px] font-medium px-4 py-3 rounded-full bg-neutral-100"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/signin?next=/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center text-[15px] font-medium px-4 py-3 rounded-full bg-neutral-100"
              >
                Sign in
              </Link>
            )}
            <Link
              href={user ? "/dashboard" : "/signup"}
              onClick={() => setMobileOpen(false)}
              className="flex-1 text-center btn-accent text-[15px] font-semibold px-4 py-3 rounded-full"
            >
              {user ? "Dashboard" : "Get started"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Hero: copy left, live product preview right ── */
function Hero() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-28 lg:pt-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-14 items-center">
        <div>
          <h1
            className="hero-line font-display leading-[1.0] tracking-[-0.03em] mb-6"
            style={{ color: INK, fontSize: "clamp(2.75rem, 5.2vw, 4.5rem)" }}
          >
            <span className="block" style={{ animationDelay: "60ms" }}>
              Your restaurant online{" "}
              <span style={{ color: ACCENT }}>in&nbsp;minutes</span>
            </span>
          </h1>
          <p
            className="hero-line text-[18px] leading-[1.6] text-neutral-600 mb-9 max-w-[42ch]"
            style={{ animationDelay: "220ms" }}
          >
            Tablecraft is an AI website builder and management console for
            restaurants and cafés. Website, bookings, ordering all in one
            place.
          </p>
          <div
            className="hero-line flex flex-wrap items-center gap-3"
            style={{ animationDelay: "300ms" }}
          >
            <Link
              href="/signup"
              className="btn-accent text-[16px] font-semibold px-7 py-4 rounded-full btn-press"
            >
              Create your restaurant
            </Link>
            <a
              href="#features"
              className="text-[16px] font-semibold px-6 py-4 rounded-full bg-neutral-100 text-neutral-950 hover:bg-neutral-200 btn-press"
            >
              See how it works
            </a>
          </div>
          <p
            className="hero-line text-[14px] text-neutral-500 mt-5"
            style={{ animationDelay: "370ms" }}
          >
            Free to start · No credit card required
          </p>
        </div>
        <div className="hero-line" style={{ animationDelay: "200ms" }}>
          <DevicePreview />
        </div>
      </div>
    </section>
  );
}

/* ── Features: pick a capability, the product shows it ── */
function FeaturesSection() {
  const [active, setActive] = useState(0);
  const count = FEATURES.length;
  const prev = () => setActive((i) => (i - 1 + count) % count);
  const next = () => setActive((i) => (i + 1) % count);
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % count), 3000);
    return () => clearInterval(id);
  }, [active, count]);
  return (
    <section id="features" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32">
        <Reveal>
          <h2
            className="font-display leading-[1.02] tracking-[-0.03em] max-w-[18ch]"
            style={{ color: INK, fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
          >
            Everything runs on AI.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="text-[18px] leading-[1.6] text-neutral-600 mt-5 max-w-[48ch]">
            From booking guests to scanning menus to designing the site.
            Tablecraft does the heavy lifting.
          </p>
        </Reveal>

        <div className="mt-14 grid lg:grid-cols-[5fr_7fr] gap-10 lg:gap-14 items-start">
          <div
            role="tablist"
            aria-label="Features"
            className="flex flex-col gap-2"
          >
            {FEATURES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`text-left rounded-2xl px-6 py-5 transition-colors duration-300 btn-press ${
                  i === active
                    ? "bg-neutral-950"
                    : "bg-transparent hover:bg-neutral-100"
                }`}
              >
                <p
                  className={`font-display text-[21px] leading-snug tracking-[-0.01em] transition-colors duration-300 ${
                    i === active ? "text-white" : "text-neutral-500"
                  }`}
                >
                  {item.title}
                </p>
                {i === active && (
                  <p className="xfade text-[16px] leading-[1.6] text-neutral-400 mt-3 max-w-[44ch]">
                    {item.body}
                  </p>
                )}
              </button>
            ))}
          </div>

          <div
            className="rounded-3xl bg-neutral-100 border-2 border-neutral-950 p-4 sm:p-8 lg:sticky lg:top-24"
            role="region"
            aria-roledescription="carousel"
            aria-label="Feature screenshots"
          >
            <div className="overflow-hidden rounded-2xl bg-white">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${active * 100}%)` }}
              >
                {FEATURES.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex h-[380px] sm:h-[440px] w-full shrink-0 items-center justify-center p-4"
                    aria-hidden={i !== active}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.alt}
                      className="h-full w-auto max-w-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2" role="group" aria-label="Choose a screenshot">
                {FEATURES.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show ${item.id}`}
                    aria-current={i === active}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      i === active ? "w-8 bg-neutral-950" : "w-2.5 bg-neutral-300 hover:bg-neutral-400"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Previous screenshot"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-950 hover:bg-neutral-200 btn-press"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Next screenshot"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-950 text-white hover:bg-neutral-800 btn-press"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── How it works: three plain steps on one line ── */
function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-neutral-100 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32">
        <Reveal>
          <h2
            className="font-display leading-[1.02] tracking-[-0.03em] max-w-[16ch]"
            style={{ color: INK, fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
          >
            Live in about 15 minutes.
          </h2>
        </Reveal>
        <div className="mt-16 grid md:grid-cols-3 gap-10 md:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <div className="flex flex-col h-full">
                <span
                  className="block h-3 w-3 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                  aria-hidden="true"
                />
                <h3
                  className="font-display text-[26px] leading-tight tracking-[-0.01em] mt-8 mb-3"
                  style={{ color: INK }}
                >
                  {s.title}
                </h3>
                <p className="text-[17px] leading-[1.6] text-neutral-600 max-w-[34ch]">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="mt-14">
            <Link
              href="/signup"
              className="btn-accent inline-block text-[16px] font-semibold px-7 py-4 rounded-full btn-press"
            >
              Create your restaurant
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Operations: the console on black, one screen for the whole floor ── */
function OpsPreviewSection() {
  const stats = [
    { label: "Total tables", value: "4", sub: "2 available" },
    { label: "Booked today", value: "1", sub: "reservations" },
    { label: "Live orders", value: "1", sub: "in the kitchen" },
    { label: "Seats free", value: "9", sub: "right now" },
  ];
  return (
    <section
      aria-label="Staff operations preview"
      className="bg-neutral-950 text-white"
    >
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-[5fr_7fr] gap-14 items-center">
        <div>
          <Reveal>
            <h2
              className="font-display leading-[1.02] tracking-[-0.03em]"
              style={{ fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
            >
              One screen for the whole floor.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[18px] leading-[1.6] text-neutral-400 mt-5 max-w-[44ch]">
              Tables, bookings, and live orders update in real time. Confirm
              guests, fire table orders, and see the kitchen queue from one
              dashboard.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="flex flex-wrap gap-3 mt-9">
              <Link
                href="/signup"
                className="btn-accent text-[16px] font-semibold px-7 py-4 rounded-full btn-press"
              >
                Try the console
              </Link>
              <a
                href="#restaurants"
                className="text-[16px] font-semibold px-6 py-4 rounded-full bg-white/10 hover:bg-white/20 btn-press"
              >
                Explore a live demo
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div
            className="rounded-3xl bg-white text-neutral-950 p-5 sm:p-7"
            data-ui
            aria-hidden="true"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[22px] leading-tight">
                  Malabar Bites · Dashboard
                </p>
                <p className="text-[14px] text-neutral-500 mt-1">
                  Tuesday, September 15, 2026
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-green-700 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600" /> Live
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-neutral-100 px-3.5 py-3.5"
                >
                  <p className="text-[13px] text-neutral-500">{s.label}</p>
                  <p className="font-display mt-1 tabular-nums text-[30px] leading-none">
                    {s.value}
                  </p>
                  <p className="text-[12px] text-neutral-500 mt-1">{s.sub}</p>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-2.5">
              <div className="rounded-xl bg-neutral-100 px-4 py-4">
                <p className="text-[13px] text-neutral-500">
                  Today&apos;s bookings
                </p>
                <p className="text-[16px] font-semibold mt-2">Kaushik</p>
                <p className="text-[13px] text-neutral-500 mt-0.5 tabular-nums">
                  4:48 PM · Table 1 · 3 people
                </p>
                <p className="mt-3 inline-block rounded-full bg-green-100 px-2.5 py-1 text-[12px] font-semibold text-green-800">
                  Confirmed
                </p>
              </div>
              <div className="rounded-xl bg-neutral-100 px-4 py-4">
                <p className="text-[13px] text-neutral-500">Order queue</p>
                <p className="text-[16px] font-semibold mt-2">Table 2</p>
                <p className="text-[13px] text-neutral-600 mt-0.5 tabular-nums">
                  <span className="font-semibold" style={{ color: ACCENT }}>
                    3×
                  </span>{" "}
                  Chicken roast · AED 96
                </p>
                <p className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-semibold text-amber-800">
                  Pending
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Demo restaurants: live sites, no login ── */
function RestaurantsSection() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await fetch("/api/demo-restaurants");
        const data = await res.json();
        setOrgs(data.orgs ?? []);
      } catch {
        setOrgs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  return (
    <section id="restaurants" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-[4fr_8fr] gap-12">
        <div>
          <Reveal>
            <h2
              className="font-display leading-[1.02] tracking-[-0.03em]"
              style={{ color: INK, fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
            >
              Demo restaurants
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[17px] leading-[1.6] text-neutral-600 mt-5 max-w-[30ch]">
              Live sites below. Opening one needs no login.
            </p>
          </Reveal>
        </div>
        <div>
          {loading ? (
            <p className="text-[17px] text-neutral-500">Loading restaurants…</p>
          ) : orgs.length === 0 ? (
            <p className="text-[17px] text-neutral-500">
              No restaurants yet. Be the first.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {orgs.map((org, i) => {
                const color = org.theme_color ?? ACCENT;
                return (
                  <Reveal key={org.id} delay={Math.min(i, 5) * 60}>
                    <div className="rounded-2xl bg-neutral-100 border border-[#00000] p-6 h-full flex flex-col card-lift">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
                          style={{ backgroundColor: color }}
                        >
                          {org.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={org.logo_url}
                              alt={`${org.name} logo`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            org.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="font-display text-[20px] leading-tight truncate"
                            style={{ color: INK }}
                          >
                            {org.name}
                          </p>
                          {org.tagline && (
                            <p className="text-[14px] text-neutral-500 truncate">
                              {org.tagline}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-[14px] text-neutral-400 mb-6">
                        /{org.slug}
                      </p>
                      <div className="mt-auto flex gap-2">
                        <ViewSiteLink
                          href={`/${org.slug}`}
                          className="flex-1 text-center text-[15px] font-semibold py-3 rounded-full bg-white text-neutral-950 hover:bg-neutral-200 btn-press"
                          ariaLabel={`Visit ${org.name}`}
                        >
                          Visit site
                        </ViewSiteLink>
                        <a
                          href={`/api/demo/redirect?org=${org.slug}`}
                          className="flex-1 text-center text-[15px] font-semibold py-3 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 btn-press whitespace-nowrap"
                        >
                          Demo console
                        </a>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing: three tonal panels, annual toggle ── */
function PricingSection() {
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const [persisted] = useState(() => {
    try {
      return (
        (localStorage.getItem("tc-billing") as BillingInterval) || "monthly"
      );
    } catch {
      return "monthly" as BillingInterval;
    }
  });
  useEffect(() => {
    setBilling(persisted === "annual" ? "annual" : "monthly");
  }, [persisted]);
  function pick(v: BillingInterval) {
    setBilling(v);
    try {
      localStorage.setItem("tc-billing", v);
    } catch {
      /* private mode */
    }
  }

  const router = useRouter();
  async function checkout(planKey: "pro" | "max") {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/signin?next=/dashboard");
      return;
    }
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
    router.push(
      `/console/pricing?org=${orgId}&plan=${planKey}&billing=${billing}`,
    );
  }

  const isAnnual = billing === "annual";
  const cards = PRICING.map((p) => {
    const paidKey = p.planKey;
    const monthlyAed = paidKey ? PLAN_MONTHLY_AED[paidKey] : 0;
    const annualAed = paidKey ? PLAN_ANNUAL_AED[paidKey] : 0;
    const savings = paidKey ? getAnnualSavings(paidKey) : null;
    const equiv = paidKey ? getAnnualMonthlyEquivalent(paidKey) : 0;
    return {
      plan: p,
      price: !paidKey ? "0" : isAnnual ? `${annualAed}` : `${monthlyAed}`,
      unit: !paidKey ? "AED" : isAnnual ? "AED / year" : "AED / month",
      note: !paidKey
        ? p.period
        : isAnnual
          ? `AED ${equiv} a month, billed annually. Saves AED ${savings!.savedAed.toLocaleString()}.`
          : `Or AED ${annualAed.toLocaleString()} a year. One month free.`,
    };
  });

  return (
    <section id="pricing" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 pt-24 lg:pt-32 pb-12">
        <Reveal>
          <h2
            className="font-display leading-[1.02] tracking-[-0.03em]"
            style={{ color: INK, fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
          >
            Simple, transparent pricing.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="text-[18px] leading-[1.6] text-neutral-600 mt-5 max-w-[52ch]">
            Start free with a mock site. Upgrade when you&apos;re ready to go
            live. Annual billing takes a month off, remembered next visit.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div
            className="inline-flex mt-8 p-1 rounded-full bg-neutral-100"
            role="group"
            aria-label="Billing period"
          >
            {(["monthly", "annual"] as BillingInterval[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pick(v)}
                aria-pressed={billing === v}
                className={`px-6 py-2.5 text-[15px] font-semibold rounded-full transition-colors btn-press ${
                  billing === v
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-600 hover:text-neutral-950"
                }`}
              >
                {v === "annual" ? "Annual · 1 month free" : "Monthly"}
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-8 grid md:grid-cols-3 gap-4">
        {cards.map(({ plan: p, price, unit, note }, i) => {
          const isPro = p.name === "Pro";
          const isMax = p.name === "Max";
          const dark = isPro || isMax;
          const panel = isPro
            ? "bg-neutral-950 text-white"
            : isMax
              ? "text-white"
              : "bg-neutral-100 text-neutral-950";
          const sub = dark ? "text-neutral-400" : "text-neutral-600";
          return (
            <Reveal key={p.name} delay={i * 80}>
              <div
                className={`rounded-3xl p-8 sm:p-9 flex flex-col h-full ${panel}`}
                style={isMax ? { backgroundColor: ACCENT } : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-[30px] leading-none">
                    {p.name}
                  </p>
                  {p.highlighted && (
                    <span
                      className={`text-[13px] font-semibold px-3 py-1 rounded-full ${isPro ? "bg-white text-neutral-950" : "bg-white/20 text-white"}`}
                    >
                      Most popular
                    </span>
                  )}
                </div>
                <p
                  className={`text-[16px] leading-[1.6] mt-4 max-w-[30ch] ${sub}`}
                >
                  {p.description}
                </p>
                <p className="mt-8 flex items-baseline gap-2">
                  <span className="font-display tabular-nums leading-none text-[64px]">
                    {price}
                  </span>
                  <span className={`text-[16px] ${sub}`}>{unit}</span>
                </p>
                <p className={`text-[14px] mt-2 tabular-nums ${sub}`}>{note}</p>
                <ul className={`mt-7 space-y-2.5 text-[15px] ${sub}`}>
                  {p.features.map((feat) => (
                    <li key={feat} className="flex gap-2.5">
                      <svg
                        className="shrink-0 mt-[5px]"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isPro ? "#fff" : isMax ? "#fff" : ACCENT}
                        strokeWidth="3"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-9">
                  {p.planKey ? (
                    <button
                      type="button"
                      onClick={() => checkout(p.planKey as "pro" | "max")}
                      className={`w-full text-[16px] font-semibold px-8 py-4 rounded-full btn-press ${
                        isPro
                          ? "bg-white text-neutral-950 hover:bg-neutral-200"
                          : isMax
                            ? "bg-neutral-950 text-white hover:bg-neutral-800"
                            : "bg-neutral-950 text-white hover:bg-neutral-800"
                      }`}
                    >
                      {p.cta}
                    </button>
                  ) : (
                    <Link
                      href={p.ctaLink}
                      className="block text-center w-full text-[16px] font-semibold px-8 py-4 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 btn-press"
                    >
                      {p.cta}
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
      <p className="text-center text-[14px] text-neutral-500 py-8">
        No credit card to start · Cancel anytime · Email support on paid plans
      </p>
    </section>
  );
}

/* ── FAQ: answers in a tonal panel ── */
function FaqSection() {
  return (
    <section id="faq" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-[4fr_8fr] gap-12">
        <div>
          <Reveal>
            <h2
              className="font-display leading-[1.02] tracking-[-0.03em]"
              style={{ color: INK, fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
            >
              Questions, answered.
            </h2>
          </Reveal>
        </div>
        <Reveal delay={80}>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="faq rounded-2xl bg-neutral-100 border-2 border-neutral-950 px-6 py-5"
              >
                <summary
                  className="cursor-pointer list-none flex items-center justify-between gap-4 text-[17px] font-semibold"
                  style={{ color: INK }}
                >
                  {f.q}
                  <span
                    className="faq-icon text-2xl leading-none font-normal shrink-0 transition-transform duration-300"
                    style={{ color: ACCENT }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="text-[16px] text-neutral-600 leading-[1.65] mt-3 max-w-[62ch]">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Contact: one prompt, stacked fields ── */
function ContactSection() {
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
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "w-full bg-neutral-100 text-[16px] px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-950 placeholder:text-neutral-400";

  return (
    <section id="contact" className="bg-neutral-100 scroll-mt-20">
      <div className="max-w-[640px] mx-auto px-6 py-24 lg:py-32">
        <div className="rounded-3xl bg-white border-2 border-neutral-950 p-6 sm:p-10">
          <Reveal>
            <h2
              className="font-display leading-[1.05] tracking-[-0.02em]"
              style={{ color: INK, fontSize: "clamp(2rem, 3.4vw, 2.75rem)" }}
            >
              Questions? Ideas?
            </h2>
            <p className="text-[18px] text-neutral-600 mt-3">
              Tell us about your restaurant.
            </p>
          </Reveal>
          <Reveal delay={80}>
            {submitted ? (
              <div className="mt-10 rounded-2xl bg-neutral-100 p-8">
                <p
                  className="font-display text-[28px] leading-tight"
                  style={{ color: INK }}
                >
                  Thank you, {name}.
                </p>
                <p className="text-[17px] text-neutral-600 mt-3">
                  We received your note and reply within one business day.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setName("");
                    setEmail("");
                    setMessage("");
                  }}
                  className="mt-6 text-[15px] font-semibold underline underline-offset-4"
                  style={{ color: INK }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-10 space-y-4">
                <div>
                  <label
                    htmlFor="m-name"
                    className="block text-[14px] font-medium text-neutral-700 mb-2"
                  >
                    Your name
                  </label>
                  <input
                    id="m-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Chef or restaurant owner"
                    required
                    className={fieldClass}
                    style={{ color: INK }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="m-email"
                    className="block text-[14px] font-medium text-neutral-700 mb-2"
                  >
                    Email address
                  </label>
                  <input
                    id="m-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    required
                    className={fieldClass}
                    style={{ color: INK }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="m-message"
                    className="block text-[14px] font-medium text-neutral-700 mb-2"
                  >
                    Message
                  </label>
                  <textarea
                    id="m-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your restaurant or any questions…"
                    required
                    className={`${fieldClass} resize-none`}
                    style={{ color: INK }}
                  />
                </div>
                {error && (
                  <p
                    className="text-[15px] text-red-700 bg-red-50 px-4 py-3 rounded-xl"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-accent w-full text-[16px] font-semibold py-4 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 btn-press"
                >
                  {submitting ? (
                    "Sending…"
                  ) : (
                    <>
                      Send message <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
                <p className="text-[14px] text-neutral-500">
                  We reply within one business day.
                </p>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── CTA: full-bleed orange field, closing line, one action ── */
function CTASection() {
  return (
    <section aria-label="Get started" style={{ backgroundColor: ACCENT }}>
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32">
        <Reveal>
          <h2
            className="font-display text-white leading-[0.98] tracking-[-0.03em] max-w-[14ch]"
            style={{ fontSize: "clamp(3rem, 7vw, 6rem)" }}
          >
            Open your doors online.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="text-white/90 text-[18px] leading-[1.6] mt-6 max-w-[44ch]">
            Create your restaurant site in minutes. No credit card required to
            start.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="flex flex-wrap gap-3 mt-10">
            <Link
              href="/signup"
              className="inline-block bg-neutral-950 text-white text-[16px] font-semibold px-8 py-4 rounded-full hover:bg-neutral-800 btn-press"
            >
              Sign up free
            </Link>
            <a
              href="#pricing"
              className="inline-block bg-white/15 text-white text-[16px] font-semibold px-8 py-4 rounded-full hover:bg-white/25 btn-press"
            >
              View pricing
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer: a quiet, complete close ── */
function Footer() {
  return (
    <footer className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center text-[15px]">
        <p className="font-display text-[22px] tracking-tight" style={{ color: INK }}>
          Tablecraft
        </p>
        <nav
          className="flex flex-wrap gap-x-6 gap-y-2 md:justify-center"
          aria-label="Footer"
        >
          {[
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "FAQ", href: "#faq" },
            { label: "Contact", href: "#contact" },
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-neutral-600 hover:text-neutral-950 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <p className="text-neutral-500 md:text-right tabular-nums">
          © {new Date().getFullYear()} Tablecraft · Built for Restaurants
        </p>
      </div>
    </footer>
  );
}

/* ── Page ── */
export default function MarketingHomePage() {
  return (
    <div className="min-h-svh bg-white antialiased" style={{ color: INK }}>
      <style>{`
        .font-display { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-weight: 500; }
        .btn-accent { background: ${ACCENT}; color: #fff; }
        .btn-accent:hover { background: ${ACCENT_DARK}; }
        .btn-press { transition: transform 120ms ease, background-color 160ms ease, color 160ms ease; }
        .btn-press:active { transform: scale(0.97); }
        .card-lift { transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), background-color 260ms ease; }
        .card-lift:hover { transform: translateY(-4px); background-color: #e9e9e9; }
        .faq[open] .faq-icon { transform: rotate(45deg); }
        @keyframes hero-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .hero-line { opacity: 0; animation: hero-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .rv { opacity: 0; transform: translateY(20px); transition: opacity 600ms ease, transform 600ms cubic-bezier(0.22, 1, 0.36, 1); transition-delay: var(--rvd, 0ms); }
        .rv-in { opacity: 1; transform: translateY(0); }
        @keyframes xfade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .xfade { animation: xfade-in 450ms cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .float-slow { animation: float-slow 7s ease-in-out infinite; }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.6); opacity: 0; } }
        .pulse-ring { animation: pulse-ring 1.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hero-line, .rv, .xfade, .float-slow, .pulse-ring, .card-lift { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }
        }
      `}</style>
      <a
        href="#features"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-1/2 focus:-translate-x-1/2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-neutral-950 focus:text-white focus:text-sm"
      >
        Skip to content
      </a>
      <Navbar />
      <main>
        <Hero />
        <FeaturesSection />
        <HowItWorksSection />
        <OpsPreviewSection />
        <RestaurantsSection />
        <PricingSection />
        <FaqSection />
        <ContactSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
