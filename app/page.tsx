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
const INK = "#16130f";

/* ── Reveal on scroll: heading, then text, then media, staggered ── */
function useReveal(threshold = 0.2) {
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
      { threshold }
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
    id: "chatbot",
    sentence: "Guests book tables by chatting.",
    body: "“Table for 4 this Friday at 7” — the AI collects the details, checks availability, and confirms instantly, day or night.",
    control: "See the chatbot",
    image: "/features/chatbot.png",
    alt: "The Tablecraft booking chatbot answering a guest",
  },
  {
    id: "scanner",
    sentence: "A photo of your menu becomes your menu.",
    body: "Snap your printed menu. OCR lifts every dish, price, and category into a structured digital menu in one click.",
    control: "See the scanner",
    image: "/features/menu-scanner.png",
    alt: "The Tablecraft menu scanner digitising a printed menu",
  },
  {
    id: "editor",
    sentence: "Edit the site by just asking.",
    body: "New headline, different hours, a whole new section — tell the AI in plain words and the edit lands on your live site in seconds.",
    control: "See the editor",
    image: "/features/Website_Edit.png",
    alt: "Editing a Tablecraft website by chatting with the AI",
  },
  {
    id: "images",
    sentence: "Photography without the shoot.",
    body: "Generate hero images, logos, and menu artwork from a prompt — or upload a photo and ask the AI to improve it.",
    control: "See the studio",
    image: "/features/image-editor.png",
    alt: "The Tablecraft image studio generating restaurant artwork",
  },
  {
    id: "console",
    sentence: "The whole floor on one screen.",
    body: "Tables, bookings, live orders, and kitchen tickets update in real time, on desktop and on the floor.",
    control: "See the console",
    image: "/features/dashboard.png",
    alt: "The Tablecraft staff dashboard with live tables and orders",
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
  {
    q: "Which models power the AI website builder and editor?",
    a: "We use some of the best frontier models, such as Haiku 5.5 and GPT 6.1 Solo, for the AI website builder and edits.",
  },
];

/* ── Taj screenshots (real product output) with built-in fallback ── */
function TajDesktopFallback() {
  return (
    <div className="bg-white text-neutral-900 text-left h-full flex flex-col" data-ui>
      <div className="flex items-center gap-1.5 border-b border-neutral-200 px-3 py-2 bg-neutral-50">{/* taste-skill-ignore: product UI fragment */}
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
        <span className="w-2 h-2 rounded-full bg-neutral-300" />
        <span className="ml-2 flex-1 truncate rounded bg-white border border-neutral-200 px-2 py-0.5 text-[9px] text-neutral-500">
          tablecraft.app/taj-restaurant
        </span>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100">{/* taste-skill-ignore: product UI fragment */}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            T
          </div>
          <p className="text-[11px] font-bold tracking-tight">Taj Restaurant</p>
        </div>
        <div className="flex items-center gap-2 text-[8px] text-neutral-500">
          <span>Menu</span>
          <span>About</span>
          <span>Contact</span>
          <span className="rounded-full bg-neutral-900 text-white px-2 py-1 text-[8px] font-semibold">
            Book a table
          </span>
        </div>
      </div>
      <div className="relative h-32 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative h-full flex flex-col items-center justify-center text-white px-4 text-center">
          <p className="text-[8px] uppercase tracking-widest opacity-80">Mughlai · North Indian · Dubai</p>
          <p className="text-[17px] font-bold tracking-tight leading-tight mt-0.5">Taj Restaurant</p>
          <p className="text-[9px] opacity-90 mt-0.5">Butter chicken, biryani &amp; tandoor — order ahead or book in seconds.</p>
        </div>
      </div>
      <div className="px-4 py-2.5 flex-1">
        <p className="text-[10px] font-bold mb-1.5">Popular dishes</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: "Butter Chicken", p: "AED 48" },
            { n: "Chicken Biryani", p: "AED 42" },
            { n: "Garlic Naan", p: "AED 12" },
          ].map((d) => (
            <div key={d.n} className="rounded-lg border border-neutral-200 overflow-hidden" data-ui>
              <div className="h-10 flex items-center justify-center text-[13px] font-bold text-white" style={{ backgroundColor: "#b54600" }}>{d.n.charAt(0)}</div>
              <div className="p-1.5">
                <p className="text-[8px] font-semibold truncate">{d.n}</p>
                <p className="text-[8px] text-neutral-500">{d.p}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TajMobileFallback() {
  return (
    <div className="bg-white text-neutral-900 text-left h-full flex flex-col" data-ui>
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100">{/* taste-skill-ignore: product UI fragment */}
        <p className="text-[10px] font-bold">Taj</p>
        <span className="flex flex-col gap-[3px]" aria-hidden="true">
          <span className="block w-3.5 h-[2px] bg-neutral-500" />
          <span className="block w-3.5 h-[2px] bg-neutral-500" />
          <span className="block w-3.5 h-[2px] bg-neutral-500" />
        </span>
      </div>
      <div className="p-2.5 space-y-2 flex-1">
        {["Butter Chicken · AED 48", "Chicken Biryani · AED 42", "Garlic Naan · AED 12"].map((d) => (
          <div key={d} className="rounded-lg border border-neutral-200 p-1.5">
            <p className="text-[8px] font-semibold">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TajDesktopScreen() {
  const [missing, setMissing] = useState(false);
  if (missing) return <TajDesktopFallback />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/taj-desktop.jpg"
      alt="Taj Restaurant website on a laptop"
      onError={() => setMissing(true)}
      className="h-full w-full object-cover object-top"
      draggable={false}
    />
  );
}

function TajMobileScreen() {
  const [missing, setMissing] = useState(false);
  if (missing) return <TajMobileFallback />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/taj-mobile.jpg"
      alt="Taj Restaurant website on a phone"
      onError={() => setMissing(true)}
      className="h-full w-full object-contain"
      draggable={false}
    />
  );
}

function DeviceMockup() {
  return (
    <div className="relative w-full max-w-[560px] mx-auto select-none" aria-label="Preview of a Taj restaurant website on laptop and mobile">
      <div>
        <div className="rounded-t-xl bg-neutral-300 p-2 pb-0 border border-neutral-300">
          <div className="flex items-center justify-center pb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
          </div>
          <div className="overflow-hidden rounded-t-md bg-black aspect-[2020/1476]" style={{ aspectRatio: "2020 / 1476" }}>
            <TajDesktopScreen />
          </div>
        </div>
        <div className="mx-10 h-1 rounded-full bg-neutral-500" aria-hidden="true" />
        <div
          className="mx-[-10px] bg-neutral-300 px-5 pb-3 pt-2 sm:mx-[-14px] sm:px-7"
          style={{ clipPath: "polygon(3.5% 0, 96.5% 0, 100% 100%, 0% 100%)" }}
        >
          <div className="grid grid-cols-14 gap-1" aria-hidden="true">
            {Array.from({ length: 42 }).map((_, i) => (
              <span key={i} className="h-1.5 rounded-[2px] bg-neutral-500/80" />
            ))}
          </div>
          <div className="mt-1 grid grid-cols-14 gap-1" aria-hidden="true">
            <span className="col-span-3" />
            <span className="col-span-8 h-1.5 rounded-[2px] bg-neutral-500/80" />
            <span className="col-span-3" />
          </div>
          <div className="mx-auto mt-2 h-6 w-24 rounded-md border border-neutral-400/70 bg-neutral-200/80" aria-hidden="true" />
        </div>
      </div>

      <div className="absolute right-0 sm:right-2 -bottom-6 w-[104px] sm:w-[124px]" style={{ maxWidth: 124 }}>
        <div className="rounded-[22px] bg-white p-1 border border-neutral-300">
          <div className="rounded-[20px] bg-neutral-900 p-1">
            <div className="flex items-center justify-center pb-1">
              <span className="w-10 h-3.5 rounded-full bg-black border border-neutral-800 relative">
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-neutral-700" />
              </span>
            </div>
            <div className="overflow-hidden rounded-[16px] bg-black aspect-[9/19]" style={{ aspectRatio: "9 / 19" }}>
              <TajMobileScreen />
            </div>
            <div className="flex items-center justify-center pt-1">
              <span className="w-8 h-1 rounded-full bg-neutral-700" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-1 sm:left-2 -bottom-7 flex items-center gap-1.5 bg-white px-2.5 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
        <span className="text-[11px] font-medium text-neutral-600">Live preview — Taj Restaurant</span>
      </div>
    </div>
  );
}

/* ── Navigation: wordmark, four links, one action ── */
function Navbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

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
    <header className="sticky top-0 z-50 bg-neutral-100 border-b-2 border-neutral-900">{/* taste-skill-ignore: deliberate black rule separating the header */}
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-display text-lg" style={{ color: INK }}>
          Tablecraft
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-[15px] text-neutral-600 hover:text-neutral-900 navlink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm font-medium px-4 py-2.5 text-neutral-700 hover:text-neutral-900"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/signin?next=/dashboard"
              className="text-sm font-medium px-4 py-2.5 text-neutral-700 hover:text-neutral-900"
            >
              Sign in
            </Link>
          )}
          <Link
            href={user ? "/dashboard" : "/signup"}
            className="btn-primary text-sm px-5 py-2.5"
          >
            {user ? "Dashboard" : "Get started"}
          </Link>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-neutral-900"
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
        <div className="md:hidden bg-neutral-100 px-6 py-4">
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
          <div className="flex gap-2 pt-2 pb-1">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  handleSignOut();
                  setMobileOpen(false);
                }}
                className="flex-1 text-sm font-medium px-4 py-3 border border-neutral-300"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/signin?next=/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center text-sm font-medium px-4 py-3 border border-neutral-300"
              >
                Sign in
              </Link>
            )}
            <Link
              href={user ? "/dashboard" : "/signup"}
              onClick={() => setMobileOpen(false)}
              className="flex-1 text-center btn-primary text-sm px-4 py-3"
            >
              {user ? "Dashboard" : "Get started"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Hero: menu sheet left, the room (devices on black) right ── */
function Hero() {
  return (
    <section className="bg-[#f7f2e9]">
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-24 grid lg:grid-cols-[45fr_55fr] gap-12 items-center">
        <div>
          <h1 className="hero-line font-display leading-[1.02] mb-5" style={{ color: INK, fontSize: "clamp(2.5rem, 3.6vw, 3.5rem)" }}>
            <span className="hero-line block" style={{ animationDelay: "60ms" }}>Get your restaurant</span>
            <span className="hero-line block" style={{ animationDelay: "150ms" }}>online in minutes.</span>
          </h1>
          <p className="hero-line text-[18px] leading-[1.6] text-neutral-600 mb-8 max-w-[40ch]" style={{ animationDelay: "240ms" }}>
            Tablecraft is the AI website builder for restaurants — site, bookings, ordering, and staff console in one place.
          </p>
          <p className="hero-line mb-3" style={{ animationDelay: "320ms" }}>
            <Link href="/signup" className="btn-accent inline-block text-base font-semibold px-9 py-4">
              Create your restaurant
            </Link>
          </p>
          <p className="hero-line text-[15px] text-neutral-500" style={{ animationDelay: "390ms" }}>
            Free to start · No credit card required
          </p>
        </div>
        <div className="hero-line" style={{ animationDelay: "250ms" }}>
          <DeviceMockup />
        </div>
      </div>
    </section>
  );
}

/* ── Features: sticky output left, capability blocks right, each with a control ── */
function FeaturesSection() {
  const [active, setActive] = useState(0);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.i);
            if (!Number.isNaN(i)) setActive(i);
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px" }
    );
    blockRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const f = FEATURES[active];
  return (
    <section id="features" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-12">
        <div className="lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] flex items-center bg-neutral-950 px-6 py-10 lg:py-0">
          <figure className="w-full max-w-[420px] mx-auto" data-ui>
            <div key={f.id} className="xfade overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.image} alt={f.alt} className="w-full h-auto block" loading="lazy" />
            </div>
            <figcaption className="mt-4 text-[15px] text-neutral-400">{f.sentence}</figcaption>
          </figure>
        </div>
        <div>
          <Reveal>
            <h2 className="font-display leading-[1.05] mb-4" style={{ color: INK, fontSize: "clamp(2rem, 3vw, 2.75rem)" }}>
              Everything runs<br />on AI.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[17px] leading-[1.6] text-neutral-600 max-w-[44ch] mb-4">
              From booking guests to scanning menus to designing the site — Tablecraft does the heavy lifting.
            </p>
          </Reveal>
          <div className="mt-10">
            {FEATURES.map((item, i) => (
              <div
                key={item.id}
                ref={(el) => {
                  blockRefs.current[i] = el;
                }}
                data-i={i}
                className="py-10 min-h-[46vh] lg:min-h-[56vh] flex flex-col justify-center"
              >
                <Reveal delay={40}>
                  <p className="font-display leading-[1.15] mb-3" style={{ color: i === active ? ACCENT : INK, fontSize: "clamp(1.5rem, 2.2vw, 2rem)" }}>
                    {item.sentence}
                  </p>
                  <p className="text-[17px] leading-[1.6] text-neutral-600 max-w-[44ch] mb-5">{item.body}</p>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={i === active}
                    className={`text-[15px] font-semibold px-5 py-2.5 ${i === active ? "btn-accent" : "btn-ghost"}`}
                  >
                    {i === active ? "Showing now" : item.control}
                  </button>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── How it works: statements left, live fragment right ── */
const STEPS = [
  {
    lead: "First, claim it.",
    body: "Sign up, pick a name, claim your public URL, and generate the design.",
    state: 0,
  },
  {
    lead: "Then, fill it.",
    body: "Scan your printed menu with AI and arrange your tables.",
    state: 1,
  },
  {
    lead: "Finally, open it.",
    body: "Upgrade and go live. Guests book through the chatbot and order online.",
    state: 2,
  },
];

function HowItWorksSection() {
  const [active, setActive] = useState(0);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.i);
            if (!Number.isNaN(i)) setActive(i);
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px" }
    );
    blockRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-[5fr_7fr] gap-12">
        <div>
          <Reveal>
            <h2 className="font-display leading-[1.05] mb-12" style={{ color: INK, fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)" }}>
              Three steps.<br />One afternoon.
            </h2>
          </Reveal>
          <ol className="list-none">
            {STEPS.map((s, i) => (
              <li key={s.lead} className="min-h-[38vh] lg:min-h-[52vh] flex flex-col justify-center">
                <div
                  ref={(el) => {
                    blockRefs.current[i] = el;
                  }}
                  data-i={i}
                >
                  <p
                    className="font-display leading-[1.15] mb-3 transition-colors duration-300"
                    style={{ color: active === i ? INK : "#a8a29e", fontSize: "clamp(1.5rem, 2.2vw, 2rem)" }}
                  >
                    {s.lead}
                  </p>
                  <p className="text-[16px] leading-[1.6] max-w-[40ch]" style={{ color: active === i ? "#57534e" : "#a8a29e" }}>
                    {s.body}
                  </p>
                  <Link
                    href="/signup"
                    className={`inline-block mt-5 text-[15px] font-semibold px-5 py-2.5 ${active === i ? "btn-accent" : "btn-ghost"}`}
                  >
                    {i === 0 ? "Start step one" : i === 1 ? "See the scanner" : "Go live"}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] flex items-center">
          <div className="w-full max-w-[520px] mx-auto bg-neutral-950 text-white px-8 py-10" data-ui>
            <p className="text-[15px] text-neutral-400 mb-6">tablecraft.app/{active === 0 ? "…" : active === 1 ? "taj-restaurant" : "taj-restaurant · live"}</p>
            {active === 0 && (
              <div className="xfade">
                <p className="font-display text-white mb-6" style={{ fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)" }}>Name your restaurant</p>
                <div className="border border-neutral-700 px-4 py-3.5 text-[17px] text-neutral-500">e.g. Taj Restaurant</div>
                <div className="mt-6 inline-block text-[15px] font-semibold px-7 py-3" style={{ backgroundColor: ACCENT, color: "#fff" }}>
                  Claim your URL
                </div>
              </div>
            )}
            {active === 1 && (
              <div className="xfade">
                <p className="font-display text-white mb-6" style={{ fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)" }}>Menu, scanned</p>
                <ul className="space-y-3 text-[17px]">
                  {["Butter Chicken · AED 48", "Chicken Biryani · AED 42", "Garlic Naan · AED 12"].map((d) => (
                    <li key={d} className="flex items-center gap-3">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="tabular-nums">{d}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[15px] text-neutral-400">4 tables arranged · floor plan saved</p>
              </div>
            )}
            {active === 2 && (
              <div className="xfade">
                <p className="font-display text-white mb-4" style={{ fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)" }}>You&apos;re live</p>
                <p className="text-[17px] leading-[1.6] text-neutral-300 mb-6 max-w-[38ch]">
                  Guests are booking Table 2 for tonight. The kitchen sees the ticket the second they order.
                </p>
                <div className="inline-block text-[15px] font-semibold px-7 py-3" style={{ backgroundColor: ACCENT, color: "#fff" }}>
                  Open the console
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Ambiance: one full-bleed photograph, slow drift ── */
function AmbianceSection() {
  return (
    <section aria-label="The dining room" className="bg-white">
      <div className="max-w-6xl mx-auto px-6 pb-24 lg:pb-32">
        <Reveal>
          <figure>
            <div className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero.jpg"
                alt="A candlelit restaurant dining room at night"
                className="drift w-full h-[52svh] lg:h-[68svh] object-cover block"
                loading="lazy"
              />
            </div>
            <figcaption className="mt-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
              <p className="font-display leading-tight" style={{ color: INK, fontSize: "clamp(1.5rem, 2.2vw, 2rem)" }}>
                Built for rooms like this one.
              </p>
              <p className="text-[15px] text-neutral-500">The dining room, photographed. Tablecraft handles the internet.</p>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Operations preview: the real console fragment ── */
function OpsPreviewSection() {
  const stats = [
    { label: "Total tables", value: "4", sub: "2 available" },
    { label: "Booked today", value: "1", sub: "reservations" },
    { label: "Order count", value: "1", sub: "live orders" },
    { label: "Available now", value: "2", sub: "9 seats" },
  ];
  return (
    <section aria-label="Staff operations preview" className="bg-neutral-100">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Reveal>
            <h2 className="font-display leading-[1.05] mb-4" style={{ color: INK, fontSize: "clamp(2rem, 3vw, 2.75rem)" }}>
              One screen<br />for the whole floor.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[17px] leading-[1.6] text-neutral-600 mb-8 max-w-[44ch]">
              Tables, bookings, and live orders update in real time. Search reservations, confirm guests, and fire table orders, all from the dashboard.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary text-[15px] font-semibold px-6 py-3">
                Try the console
              </Link>
              <a href="#restaurants" className="btn-ghost text-[15px] font-semibold px-6 py-3">
                Explore a live demo
              </a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <div className="bg-white border-2 border-neutral-900" data-ui aria-hidden="true">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-xl" style={{ color: INK }}>Malabar Bites&apos;s Dashboard</p>
                  <p className="text-[13px] text-neutral-500 mt-0.5">Tuesday, September 15, 2026</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-green-700 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600" /> Live
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {stats.map((s) => (
                  <div key={s.label} className="bg-neutral-100 px-3 py-3">
                    <p className="text-[13px] text-neutral-500">{s.label}</p>
                    <p className="font-display mt-0.5 tabular-nums" style={{ color: INK, fontSize: "1.75rem" }}>{s.value}</p>
                    <p className="text-[13px] text-neutral-500">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6 space-y-5">
              <div>
                <p className="text-[13px] text-neutral-500 mb-2">Today&apos;s bookings</p>
                <div className="bg-neutral-100 px-4 py-3.5">
                  <p className="text-[15px] font-semibold" style={{ color: INK }}>Kaushik</p>
                  <p className="text-[13px] text-neutral-500 mt-0.5 tabular-nums">Tue, Sep 15 at 4:48 PM · Table 1 · 3 people</p>
                  <p className="mt-2 text-[13px] font-semibold tracking-wide text-green-700">CONFIRMED</p>
                </div>
              </div>
              <div>
                <p className="text-[13px] text-neutral-500 mb-2">Order dashboard</p>
                <div className="bg-neutral-100 px-4 py-3.5">
                  <p className="text-[15px] font-semibold" style={{ color: INK }}>Table Group · Table 2</p>
                  <p className="text-[15px] mt-1 text-neutral-600 tabular-nums">
                    <span className="font-semibold" style={{ color: ACCENT }}>3x</span> CHICKEN ROAST · AED 96
                  </p>
                  <p className="mt-2 text-[13px] font-semibold text-amber-700">Pending</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Proof: plain names in columns ── */
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
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-[3fr_9fr] gap-10">
        <div>
          <Reveal>
            <h2 className="font-display leading-[1.05]" style={{ color: INK, fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)" }}>
              Demo<br />restaurants
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[15px] text-neutral-500 mt-4 max-w-[24ch]">
              Live sites below. Opening one needs no login.
            </p>
          </Reveal>
        </div>
        <div className="lg:col-span-1">
          {loading ? (
            <p className="text-[17px] text-neutral-500">Loading restaurants…</p>
          ) : orgs.length === 0 ? (
            <p className="text-[17px] text-neutral-500">No restaurants yet. Be the first.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5">
              {orgs.map((org, i) => {
                const color = org.theme_color ?? ACCENT;
                return (
                  <Reveal key={org.id} delay={Math.min(i, 5) * 50}>
                    <div className="bg-neutral-100 border-2 border-neutral-900 p-5 h-full">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
                          style={{ backgroundColor: color }}
                        >
                          {org.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={org.logo_url} alt={`${org.name} logo`} className="w-full h-full object-cover" />
                          ) : (
                            org.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-lg leading-tight truncate" style={{ color: INK }}>{org.name}</p>
                          {org.tagline && <p className="text-[13px] text-neutral-500 truncate">{org.tagline}</p>}
                        </div>
                      </div>
                      <p className="text-[13px] text-neutral-400 mb-4">/{org.slug}</p>
                      <div className="flex gap-2">
                        <ViewSiteLink
                          href={`/${org.slug}`}
                          className="flex-1 text-center text-[15px] font-semibold py-2.5 bg-white hover:bg-neutral-200 btn-press"
                          ariaLabel={`Visit ${org.name}`}
                        >
                          Visit site
                        </ViewSiteLink>
                        <a
                          href={`/api/demo/redirect?org=${org.slug}`}
                          className="flex-1 text-center text-[15px] font-semibold py-2.5 bg-neutral-900 text-white hover:bg-neutral-700 btn-press whitespace-nowrap"
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

/* ── Pricing: three fields, hard edges, unequal widths ── */
function PricingSection() {
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const [persisted] = useState(() => {
    try {
      return (localStorage.getItem("tc-billing") as BillingInterval) || "monthly";
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
    } catch { /* private mode */ }
  }

  const router = useRouter();
  async function checkout(planKey: "pro" | "max") {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
    router.push(`/console/pricing?org=${orgId}&plan=${planKey}&billing=${billing}`);
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
          ? `AED ${equiv} a month, billed annually — saves AED ${savings!.savedAed.toLocaleString()}.`
          : `Or AED ${annualAed.toLocaleString()} a year — one month free.`,
    };
  });

  return (
    <section id="pricing" className="scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 pt-24 lg:pt-32 pb-10">
        <Reveal>
          <h2 className="font-display leading-[1.05]" style={{ color: INK, fontSize: "clamp(2rem, 3vw, 2.75rem)" }}>
            Simple, transparent pricing.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="text-[17px] leading-[1.6] text-neutral-600 mt-4 max-w-[52ch]">
            Start free with a mock site. Upgrade when you&apos;re ready to go live. Annual billing takes a month off, remembered next visit.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="inline-flex mt-7 border border-neutral-300" role="group" aria-label="Billing period">
            {(["monthly", "annual"] as BillingInterval[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pick(v)}
                aria-pressed={billing === v}
                className={`px-6 py-3 text-[15px] font-semibold capitalize transition-colors ${
                  billing === v ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {v === "annual" ? "Annual · 1 month free" : "Monthly"}
              </button>
            ))}
          </div>
        </Reveal>
      </div>
      <div className="grid md:grid-cols-[1fr_1.25fr_1fr]">
        {cards.map(({ plan: p, price, unit, note }, i) => {
          const field = p.name === "Pro" ? "bg-neutral-950 text-white" : p.name === "Max" ? "" : "bg-neutral-100";
          const ink = p.name === "Pro" ? "text-white" : "";
          const sub = p.name === "Pro" ? "text-neutral-400" : "text-neutral-600";
          return (
            <div
              key={p.name}
              className={`px-8 sm:px-10 pt-12 pb-12 flex flex-col ${field}`}
              style={p.name === "Max" ? { backgroundColor: ACCENT, color: "#fff" } : undefined}
            >
              <Reveal delay={i * 70}>
                {p.highlighted && (
                  <p className="text-[15px] font-semibold mb-4" style={{ color: p.name === "Max" ? "#fff" : ACCENT }}>
                    Most popular
                  </p>
                )}
                <p className={`font-display leading-none ${ink}`} style={{ color: p.name === "Free" ? INK : undefined, fontSize: "clamp(2rem, 3vw, 2.75rem)" }}>
                  {p.name}
                </p>
                <p className={`text-[17px] leading-[1.6] mt-3 max-w-[26ch] ${p.name === "Max" ? "" : sub}`} style={{ color: p.name === "Max" ? "#fff" : undefined }}>
                  {p.description}
                </p>
                <p className="mt-8 flex items-baseline gap-2">
                  <span className={`font-display tabular-nums leading-none ${ink}`} style={{ color: p.name === "Free" ? INK : undefined, fontSize: "clamp(3.5rem, 6vw, 5.5rem)" }}>
                    {price}
                  </span>
                  <span className={`text-[18px] ${p.name === "Max" ? "" : sub}`} style={{ color: p.name === "Max" ? "#fff" : undefined }}>{unit}</span>
                </p>
                <p className={`text-[15px] mt-2 tabular-nums ${p.name === "Max" ? "" : sub}`} style={{ color: p.name === "Max" ? "#fff" : undefined }}>{note}</p>
                <p className={`text-[15px] leading-[1.65] mt-6 max-w-[30ch] ${p.name === "Max" ? "" : sub}`} style={{ color: p.name === "Max" ? "#fff" : undefined }}>
                  {p.features.slice(0, 3).join(" · ")}.
                </p>
                <ul className={`mt-4 space-y-1.5 text-[15px] tabular-nums ${p.name === "Max" ? "" : sub}`} style={{ color: p.name === "Max" ? "#fff" : undefined }}>
                  {p.features.slice(3).map((feat) => (
                    <li key={feat}>{feat}</li>
                  ))}
                </ul>
                <div className="mt-9">
                  {p.planKey ? (
                    <button
                      onClick={() => checkout(p.planKey as "pro" | "max")}
                      className={`text-[15px] font-semibold px-8 py-3.5 btn-press ${
                        p.name === "Pro" ? "bg-white text-neutral-900 hover:bg-neutral-200" : p.name === "Max" ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-neutral-900 text-white hover:bg-neutral-700"
                      }`}
                    >
                      {p.cta}
                    </button>
                  ) : (
                    <Link href={p.ctaLink} className="inline-block text-[15px] font-semibold px-8 py-3.5 bg-neutral-900 text-white hover:bg-neutral-700 btn-press">
                      {p.cta}
                    </Link>
                  )}
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>
      <p className="text-center text-[13px] text-neutral-500 py-8 bg-white">No credit card to start · Cancel anytime · Email support on paid plans</p>
    </section>
  );
}

/* ── FAQ: answers as reading text ── */
function FaqSection() {
  return (
    <section id="faq" className="bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-[3fr_9fr] gap-10">
        <div>
          <Reveal>
            <h2 className="font-display leading-[1.05]" style={{ color: INK, fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)" }}>
              Questions,<br />answered.
            </h2>
          </Reveal>
        </div>
        <Reveal delay={80}>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="bg-neutral-100 border-2 border-neutral-900 px-5 py-4 group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-[16px] font-semibold" style={{ color: INK }}>
                  {f.q}
                  <span className="text-xl leading-none font-normal transition-transform duration-200 group-open:rotate-45 shrink-0" style={{ color: ACCENT }}>
                    +
                  </span>
                </summary>
                <p className="text-[16px] text-neutral-600 leading-[1.6] mt-3 max-w-[62ch]">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Contact: one prompt, stacked fields, arrow submit ── */
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
    <section id="contact" className="bg-neutral-100 scroll-mt-20">
      <div className="max-w-[560px] mx-auto px-6 py-24 lg:py-32">
        <Reveal>
          <p className="font-display font-medium leading-[1.25]" style={{ color: INK, fontSize: "clamp(1.5rem, 2.2vw, 1.75rem)" }}>
            <span className="block text-neutral-500">Questions? Ideas?</span>
            <span className="block">Tell us about your restaurant.</span>
          </p>
        </Reveal>
        <Reveal delay={80}>
          {submitted ? (
            <div className="mt-10">
              <p className="font-display leading-tight" style={{ color: INK, fontSize: "clamp(1.5rem, 2.2vw, 2rem)" }}>
                Thank you, {name}.
              </p>
              <p className="text-[17px] text-neutral-600 mt-3">We received your note and reply within one business day.</p>
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
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label htmlFor="m-name" className="block text-[15px] text-neutral-600 mb-1.5">Your name</label>
                <input
                  id="m-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Chef or restaurant owner"
                  required
                  className="w-full bg-white text-[17px] px-4 py-3.5 border border-neutral-300 focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
                  style={{ color: INK }}
                />
              </div>
              <div>
                <label htmlFor="m-email" className="block text-[15px] text-neutral-600 mb-1.5">Email address</label>
                <input
                  id="m-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  required
                  className="w-full bg-white text-[17px] px-4 py-3.5 border border-neutral-300 focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400"
                  style={{ color: INK }}
                />
              </div>
              <div>
                <label htmlFor="m-message" className="block text-[15px] text-neutral-600 mb-1.5">Message</label>
                <textarea
                  id="m-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your restaurant or any questions…"
                  required
                  className="w-full bg-white text-[17px] px-4 py-3.5 border border-neutral-300 focus:outline-none focus:border-neutral-900 resize-none placeholder:text-neutral-400"
                  style={{ color: INK }}
                />
              </div>
              {error && (
                <p className="text-[15px] text-red-700 bg-red-50 px-4 py-3" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full text-[17px] font-semibold py-4 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {submitting ? "Sending…" : <>Send message <span aria-hidden="true">→</span></>}
              </button>
              <p className="text-[13px] text-neutral-500">We reply within one business day.</p>
            </form>
          )}
        </Reveal>
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
          <h2 className="font-display text-white leading-[0.95]" style={{ fontSize: "clamp(3.5rem, 7vw, 7rem)" }}>
            Open your<br />doors online.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="text-white/90 text-[17px] leading-[1.6] mt-6 max-w-[44ch]">
            Create your restaurant site in minutes. No credit card required to start.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="flex flex-wrap gap-4 mt-9">
            <Link href="/signup" className="inline-block bg-neutral-900 text-white text-[16px] font-semibold px-9 py-4 hover:bg-neutral-800 btn-press">
              Sign up free
            </Link>
            <a href="#pricing" className="inline-block border-2 border-white/70 text-white text-[16px] font-semibold px-9 py-4 hover:bg-white/10 btn-press">
              View pricing
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer: a single quiet line ── */
function Footer() {
  return (
    <footer className="bg-white">
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-8 grid md:grid-cols-[1fr_auto_1fr] gap-3 items-baseline text-[15px]">
        <p className="text-neutral-500">Tablecraft — sites for restaurants</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 md:justify-center" aria-label="Footer">
          {[
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "FAQ", href: "#faq" },
            { label: "Contact", href: "#contact" },
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
          ].map((l) => (
            <a key={l.label} href={l.href} className="hover-accent" style={{ color: INK }}>
              {l.label}
            </a>
          ))}
        </nav>
        <p className="text-neutral-500 md:text-right tabular-nums">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}

/* ── Page ── */
export default function MarketingHomePage() {
  return (
    <div className="min-h-svh bg-white antialiased" style={{ color: INK }}>
      <style>{`
        .font-display { font-family: 'Playfair Display', Georgia, serif; }
        .btn-accent { background: ${ACCENT}; color: #fff; }
        .btn-accent:hover { background: #b54600; }
        .btn-primary { background: #16130f; color: #fff; }
        .btn-primary:hover { background: #2b251d; }
        .btn-ghost { background: #f5f5f4; color: #16130f; }
        .btn-ghost:hover { background: #e7e5e4; }
        .navlink { position: relative; }
        .navlink::after { content: ""; position: absolute; left: 0; bottom: -3px; height: 2px; width: 100%; background: ${ACCENT}; transform: scaleX(0); transform-origin: left; transition: transform 220ms ease; }
        .navlink:hover::after { transform: scaleX(1); }
        .hover-accent:hover { color: ${ACCENT}; }
        .btn-press { transition: transform 120ms ease, background-color 160ms ease; }
        .btn-press:active { transform: scale(0.98); }
        @keyframes hero-rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        .hero-line { opacity: 0; animation: hero-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .rv { opacity: 0; transform: translateY(24px); transition: opacity 600ms ease, transform 600ms cubic-bezier(0.22, 1, 0.36, 1); transition-delay: var(--rvd, 0ms); }
        .rv-in { opacity: 1; transform: translateY(0); }
        @keyframes xfade-in { from { opacity: 0; } to { opacity: 1; } }
        .xfade { animation: xfade-in 500ms ease; }
        @keyframes drift { from { transform: scale(1); } to { transform: scale(1.06); } }
        .drift { animation: drift 24s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .hero-line, .rv, .xfade, .drift { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }
        }
      `}</style>
      <a
        href="#features"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-1/2 focus:-translate-x-1/2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-neutral-900 focus:text-white focus:text-sm"
      >
        Skip to content
      </a>
      <Navbar />
      <main>
        <Hero />
        <FeaturesSection />
        <HowItWorksSection />
        <AmbianceSection />
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
