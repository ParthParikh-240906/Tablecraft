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
        "transition-all duration-700 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ transitionDelay: `${delay}ms` }}
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

// ─── Navigation ───────────────────────────────────────────────────────────────
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
    { label: "Restaurants", href: "#restaurants" },
    { label: "Pricing", href: "#pricing" },
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
              className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            href={user ? "/dashboard" : "/signin?next=/dashboard"}
            className="btn btn-outline text-[10px] px-2.5 py-1.5"
          >
            Dashboard
          </Link>
          <Link href="/console/login" className="btn btn-outline text-[10px] px-2.5 py-1.5">
            Console
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
              className="btn btn-accent text-xs w-full"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/signin?next=/dashboard"
              onClick={() => setMobileOpen(false)}
              className="btn btn-accent text-xs w-full"
            >
              Sign in
            </Link>
          )}
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              {l.label}
            </a>
          ))}
          <Link
            href={user ? "/dashboard" : "/signin?next=/dashboard"}
            onClick={() => setMobileOpen(false)}
            className="btn btn-outline text-xs w-full"
          >
            Dashboard
          </Link>
          <Link
            href="/console/login"
            onClick={() => setMobileOpen(false)}
            className="btn btn-outline text-xs w-full"
          >
            Console
          </Link>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Premium restaurant background image */}
      <div className="hero-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.jpg"
          alt="Elegant restaurant ambiance"
          className="hero-bg__image"
        />
        <div className="hero-bg__overlay" />
        <div className="hero-bg__glow" />
        <div className="hero-bg__scrim" />
      </div>

      <div className="relative z-10 px-4 text-center max-w-4xl">
        <Reveal>
          <p className="label-caps text-[color:var(--accent)] mb-6" style={{ fontSize: "1.5rem", letterSpacing: "0.15em" }}>Tablecraft</p>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[1.05] tracking-tight mb-8 text-[var(--ink)]">
            Your restaurant,
            <br />
            <span className="gradient-text">online</span> in minutes.
          </h1>
        </Reveal>
        <Reveal delay={300}>
          <p className="text-[var(--ink-soft)] text-lg md:text-xl lg:text-2xl mb-12 max-w-2xl mx-auto leading-relaxed opacity-95">
            AI-powered website, console, and staff dashboard — built for restaurants that want to move fast.
          </p>
        </Reveal>
        <Reveal delay={400}>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup" className="btn btn-accent text-base px-10 py-4">
              Create your restaurant
            </Link>
            <a href="#restaurants" className="btn btn-outline text-base px-10 py-4">
              Demo restaurants
            </a>
          </div>
        </Reveal>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="label-caps text-[var(--ink-faint)]">Scroll</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </div>
    </section>
  );
}

// ─── AI Features ──────────────────────────────────────────────────────────────
function FeatureCard({ feature, index }: { feature: typeof AI_FEATURES[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={index * 100}>
      <div
        className="ticket ticket--dark p-6 sm:p-8 group cursor-default transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <p className="label-caps text-sm mb-2" style={{ color: feature.color }}>{feature.subtitle}</p>
        <h3 className="font-display text-xl mb-4 text-[var(--ink)]">{feature.title}</h3>
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{feature.description}</p>
        <div
          className="mt-4 h-px transition-all duration-300"
          style={{
            width: hovered ? "100%" : "0%",
            backgroundColor: feature.color,
          }}
        />
        <button
          className="mt-3 flex items-center gap-2 text-xs font-medium transition-colors duration-200"
          style={{ color: feature.color }}
          onClick={() => setOpen(!open)}
        >
          {open ? "Show less" : "Show more"}
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          className="overflow-auto transition-all duration-300 rounded-sm"
          style={{ maxHeight: open ? "320px" : "0px", opacity: open ? 1 : 0 }}
        >
          <img
            src={feature.image}
            alt={feature.title}
            className="w-full rounded-sm mt-2 border border-[var(--rule)]"
          />
        </div>
      </div>
    </Reveal>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-4 py-[56px]">
      <Reveal>
        <p className="label-caps text-center text-[var(--accent)] mb-3" style={{ fontSize: "0.9rem", letterSpacing: "0.1em", textDecoration: "underline" }}>AI-Powered</p>
      </Reveal>
      <Reveal delay={80}>
        <h2 className="font-display text-2xl md:text-4xl text-center mb-4 text-[var(--ink)]">
          Everything runs on AI.
        </h2>
      </Reveal>
      <Reveal delay={160}>
        <p className="text-center text-[var(--ink-soft)] max-w-lg mx-auto mb-7 text-base">
          From booking guests to scanning menus to designing your site — Tablecraft handles the heavy lifting so you can focus on the food.
        </p>
      </Reveal>

      <FeaturesCarousel features={AI_FEATURES} />
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function StepCard({ n, title, body, delay }: { n: number; title: string; body: string; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="flex gap-5 items-start">
        <span
          className="flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center text-base font-bold font-display"
          style={{ background: "var(--accent)", color: "#ffffff" }}
        >
          {n}
        </span>
        <div>
          <h3 className="font-display text-xl mb-2 text-[var(--ink)]">{title}</h3>
          <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{body}</p>
        </div>
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
    <section id="how-it-works" className="max-w-2xl mx-auto px-4 py-20">
      <Reveal>
        <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "1.1rem", letterSpacing: "0.12em" }}>How it works</p>
      </Reveal>
      <Reveal delay={80}>
        <h2 className="font-display text-3xl md:text-4xl text-center mb-12 text-[var(--ink)]">
          Three steps. That's it.
        </h2>
      </Reveal>

      <div className="ticket ticket--dark p-6 sm:p-8 space-y-6">
        {steps.map((s, i) => (
          <div key={s.n}>
            <StepCard {...s} delay={i * 100} />
            {i < steps.length - 1 && <hr className="rule-dashed mt-6" />}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Browse Restaurants ───────────────────────────────────────────────────────
function RestaurantCard({ org, index }: { org: Org; index: number }) {
  const [hovered, setHovered] = useState(false);
  const color = org.theme_color ?? "#f97316";

  return (
    <Reveal delay={index * 80}>
      <Link
        href={`/${org.slug}`}
        className="ticket ticket--dark p-4 block group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
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
        <p className="text-[10px] text-[var(--ink-faint)] mb-2">/{org.slug}</p>
        <div
          className="h-px transition-all duration-300"
          style={{ width: hovered ? "100%" : "0%", backgroundColor: color }}
        />
      </Link>
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
    <section id="restaurants" className="max-w-6xl mx-auto px-4 py-20">
      <Reveal>
        <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "1.1rem", letterSpacing: "0.12em" }}>Directory</p>
      </Reveal>
      <Reveal delay={80}>
        <h2 className="font-display text-3xl md:text-4xl text-center mb-6 text-[var(--ink)]">
          Demo restaurants
        </h2>
      </Reveal>
      <Reveal delay={160}>
        <p className="text-center text-[var(--ink-soft)] max-w-lg mx-auto mb-10 text-lg leading-relaxed">
          Preview our demo sites below. Sign in to see and manage your own restaurant.
        </p>
      </Reveal>

      {loading ? (
        <div className="ticket ticket--dark p-8 text-center text-[var(--ink-faint)]">Loading restaurants…</div>
      ) : orgs.length === 0 ? (
        <div className="ticket ticket--dark p-8 text-center text-[var(--ink-faint)]">No restaurants yet. Be the first.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--rule)] border border-[var(--rule)] rounded-sm overflow-hidden">
          {orgs.map((org, i) => (
            <RestaurantCard key={org.id} org={org} index={i} />
          ))}
        </div>
      )}

      <Reveal delay={200}>
        <div className="text-center mt-6">
          <Link href="/restaurants" className="btn btn-outline text-xs">
            View all restaurants →
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function PricingCard({ plan, index }: { plan: typeof PRICING[0]; index: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (!plan.planKey || loading) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/signin?next=/signup?plan=${plan.planKey}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/one-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.planKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout failed:", data);
        alert(data.error ?? "Failed to start checkout. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Reveal delay={index * 120}>
      <div
        className={[
          "ticket ticket--dark p-5 sm:p-6 flex flex-col relative transition-all duration-300 h-full",
          plan.highlighted ? "ring-2 ring-[var(--accent)] shadow-xl" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {plan.highlighted && (
          <p className="label-caps text-[10px] mb-2" style={{ color: "var(--accent)" }}>Most popular</p>
        )}

        <p className="label-caps text-[10px] mb-1 text-[var(--ink-soft)]">{plan.name}</p>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="font-display text-3xl text-[var(--ink)]">{plan.price}</span>
          <span className="text-[10px] text-[var(--ink-faint)]">AED</span>
        </div>
        <p className="text-[10px] text-[var(--ink-faint)] mb-3">{plan.period}</p>
        <p className="text-xs text-[var(--ink-soft)] leading-relaxed mb-5 flex-grow">{plan.description}</p>

        <ul className="space-y-1.5 mb-6">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-[10px] text-[var(--ink-soft)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
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
    <section id="pricing" className="max-w-5xl mx-auto px-4 py-20">
      <Reveal>
        <p className="label-caps text-center text-[var(--accent)] mb-4" style={{ fontSize: "1.1rem", letterSpacing: "0.12em" }}>Pricing</p>
      </Reveal>
      <Reveal delay={80}>
        <h2 className="font-display text-3xl md:text-4xl text-center mb-6 text-[var(--ink)]">
          Simple, transparent pricing.
        </h2>
      </Reveal>
      <Reveal delay={160}>
        <p className="text-center text-[var(--ink-soft)] max-w-lg mx-auto mb-11 text-lg leading-relaxed">
          Start free with a mock site. Upgrade when you're ready to go live.
        </p>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-4">
        {PRICING.map((p, i) => (
          <PricingCard key={p.name} plan={p} index={i} />
        ))}
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────
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
    <section id="contact" className="max-w-2xl mx-auto px-4 py-[56px]">
      <Reveal>
        <p className="label-caps text-center text-[var(--accent)] mb-3" style={{ fontSize: "0.9rem", letterSpacing: "0.1em", textDecoration: "underline" }}>Get in touch</p>
      </Reveal>
      <Reveal delay={80}>
        <h2 className="font-display text-2xl md:text-3xl text-center mb-4 text-[var(--ink)]">
          Questions? Ideas?
        </h2>
      </Reveal>
      <Reveal delay={160}>
        <p className="text-center text-[var(--ink-soft)] mb-8 max-w-md mx-auto text-base">
          Whether you're a restaurant owner, a developer, or just curious — we'd love to hear from you.
        </p>
      </Reveal>

      <Reveal delay={240}>
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
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your restaurant or any questions..."
                  required
                  className="input resize-none"
                />
              </div>
              {error && (
                <p className="text-[10px] text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-accent w-full"
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </Reveal>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-[var(--rule)] py-10 px-4 text-center space-y-4">
      <div className="flex flex-wrap justify-center gap-6 mb-4">
        <Link href="/dashboard" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors">Back to dashboard</Link>
        <a href="#pricing" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors">Pricing</a>
        <Link href="/console/login" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors">Console</Link>
        <Link href="/restaurants" className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors">Directory</Link>
      </div>
      <Link href="/console/login" className="block text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] hover:underline transition-all">
        Sign in to your console
      </Link>
      <p className="label-caps text-[color:var(--ink-faint)]">
        <span className="text-[var(--accent)]">Tablecraft</span> · Built for restaurants
      </p>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MarketingHomePage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <Navbar />
      <Hero />
      <div className="layer2-bg border-2 border-white/50 mx-8 md:mx-16 mt-8 mb-12 rounded-sm layer2-invert">
        <FeaturesSection />
        <HowItWorksSection />
        <RestaurantsSection />
        <PricingSection />
        <ContactSection />
      </div>
      <Footer />
    </div>
  );
}
