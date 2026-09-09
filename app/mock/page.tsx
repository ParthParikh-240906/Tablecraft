"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Org {
  id: string;
  name: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
  tagline: string | null;
}

// ─── AI Features Data ────────────────────────────────────────────────────────
const AI_FEATURES = [
  {
    id: "chatbot",
    tag: "Conversational AI",
    badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    title: "AI Booking Concierge",
    subtitle: "Natural language table reservations",
    description: "Guests chat naturally — \"Table for 4 this Friday at 7pm, outdoor seating preferred\" — and the AI checks real-time seat inventory, collects dietary preferences, and confirms instantly.",
    image: "/features/chatbot.png",
    accent: "#f97316",
    stat: "99.8% Accuracy",
  },
  {
    id: "image-editor",
    tag: "Generative Studio",
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    title: "AI Image & Design Studio",
    subtitle: "Prompt-to-dish photography",
    description: "Generate cinematic hero imagery, restaurant logos, and seasonal dish graphics on command. Edit background lighting, upscale to 4K, and crop in seconds.",
    image: "/features/image-editor.png",
    accent: "#a855f7",
    stat: "4K Ready",
  },
  {
    id: "menu-scanner",
    tag: "Vision OCR",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    title: "AI Menu Digitizer",
    subtitle: "Photo to live digital menu",
    description: "Snap a photo of your printed or chalkboard menu. Our OCR extracts every dish, price in AED, allergen tags, and categories directly into your live database.",
    image: "/features/menu-scanner.png",
    accent: "#22c55e",
    stat: "< 3 Min Setup",
  },
  {
    id: "dashboard",
    tag: "Operations",
    badgeColor: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    title: "Live Staff Operations Dashboard",
    subtitle: "Unified floor & kitchen control",
    description: "One real-time command center for dining room tables, incoming orders, reservation queues, and kitchen tickets. Sync across iPads and staff phones.",
    image: "/features/dashboard.png",
    accent: "#0ea5e9",
    stat: "Real-time Sync",
  },
];

// ─── Interactive Features Data ────────────────────────────────────────────────
interface FeatureItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  tags: string[];
  color: "orange" | "emerald" | "purple" | "sky";
  image: string;
  previewName: string;
}

const FEATURES: FeatureItem[] = [
  {
    id: "chatbot",
    tag: "Conversational AI",
    title: "Natural Language Guest Concierge",
    description: "Guests chat casually on your website: \"Table for 4 this Friday at 7pm, outdoor seating preferred.\" The AI checks real-time seat inventory, collects dietary preferences, and confirms the booking in seconds.",
    tags: ["Live Inventory Sync", "Multilingual", "Dietary Compliance"],
    color: "orange",
    image: "/features/chatbot.png",
    previewName: "chatbot-interface.png — scrollable preview",
  },
  {
    id: "menu-scanner",
    tag: "Vision OCR",
    title: "AI Menu Digitizer",
    description: "Snap a single phone photo of your printed or chalkboard menu. Our OCR extracts dishes, allergen tags, descriptions, and AED pricing straight into your database.",
    tags: ["Instant Parse", "Allergen Tags", "Auto-Categorize"],
    color: "emerald",
    image: "/features/menu-scanner.png",
    previewName: "menu-scanner-interface.png — scrollable preview",
  },
  {
    id: "image-editor",
    tag: "Generative Media",
    title: "AI Image Studio",
    description: "Generate cinematic food photography, seasonal social banners, and menu headers with text prompts. Edit background lighting and upscale effortlessly.",
    tags: ["Prompt-to-Dish", "4K Upscaling", "BG Removal"],
    color: "purple",
    image: "/features/image-editor.png",
    previewName: "image-studio-interface.png — scrollable preview",
  },
  {
    id: "dashboard",
    tag: "Operations Control",
    title: "Live Staff Floor Dashboard",
    description: "Live table grid, incoming reservation queue, kitchen ticket progress, and daily specials toggles. Accessible across iPad, POS terminals, and phones.",
    tags: ["Realtime KDS", "Turn Timer", "86 Alerts"],
    color: "sky",
    image: "/features/dashboard.png",
    previewName: "dashboard-interface.png — scrollable preview",
  },
];

// ─── Pricing Data ────────────────────────────────────────────────────────────
const PRICING = [
  {
    name: "Free Sandbox",
    price: "0",
    period: "No credit card required",
    description: "Mock website and console with all AI features active. Ideal for previewing and testing your digital venue.",
    cta: "Start Free",
    ctaLink: "/signup",
    features: [
      "Mock public website",
      "Full console access",
      "All AI features active",
      "AI chatbot for bookings",
      "AI image generation",
      "Menu OCR scanner",
      "Staff dashboard",
    ],
    highlighted: false,
  },
  {
    name: "Pro Launch",
    price: "3,000",
    priceTag: "+ 200 AED/mo",
    description: "Setup fee + monthly AI & cloud compute. Live website and console built custom for your venue. Includes 10 weekly AI image generation requests and 1 senior designer monthly strategy meeting.",
    cta: "Go Pro",
    ctaLink: "/signup?plan=pro",
    features: [
      "Live public website",
      "Full console access",
      "All AI features active",
      "10 AI image requests / week",
      "1 Senior Designer meeting / month",
      "Custom domain support",
      "Priority 24/7 support",
    ],
    highlighted: true,
  },
  {
    name: "Max Scale",
    price: "3,000",
    priceTag: "+ 300 AED/mo",
    description: "Setup fee + dedicated server cluster & AI studio. Everything in Pro, expanded with 30 weekly AI image requests and 5 senior designer meetings per month for continuous menu & layout iterations.",
    cta: "Select Max",
    ctaLink: "/signup?plan=max",
    features: [
      "Live public website",
      "Full console access",
      "All AI features active",
      "30 AI image requests / week",
      "5 Senior Designer meetings / month",
      "Custom domain support",
      "White-label brand options",
    ],
    highlighted: false,
  },
];

// ─── Scroll Reveal Hook ──────────────────────────────────────────────────────
function useReveal(threshold = 0.1) {
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

// ─── Navigation ───────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-xl ${
        scrolled ? "bg-[#060607]/90 border-b border-white/[0.08] shadow-2xl" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-300">
            <svg viewBox="0 0 200 200" className="w-full h-full text-orange-400" fill="currentColor">
              <g transform="translate(100, 100)">
                <g transform="rotate(45)">
                  <path d="M-5 15 L-5 70 C-5 74 -1 78 0 78 C1 78 5 74 5 70 L5 15 Z"/>
                  <path d="M-6 15 C-6 5 -12 -5 -14 -15 L14 -15 C12 -5 6 15 6 15 Z"/>
                  <path d="M-14 -15 L-14 -55 C-14 -58 -10 -58 -10 -55 L-10 -25 C-10 -20 -8 -20 -8 -25 L-8 -55 C-8 -58 -4 -58 -4 -55 L-4 -25 C-4 -20 4 -20 4 -25 L4 -55 C4 -58 8 -58 8 -55 L8 -25 C8 -20 10 -20 10 -25 L10 -55 C10 -58 14 -58 14 -55 L14 -15 Z"/>
                </g>
                <g transform="rotate(-45)">
                  <path d="M-5 15 L-5 70 C-5 74 -1 78 0 78 C1 78 5 74 5 70 L5 15 Z"/>
                  <ellipse cx="0" cy="-36" rx="20" ry="28"/>
                </g>
              </g>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
              Tablecraft
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            </span>
            <span className="text-[10px] text-zinc-400 font-medium tracking-wider uppercase -mt-0.5">Restaurant OS</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] px-4 py-1.5 rounded-full">
          <a href="#showcase" className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-full hover:bg-white/[0.06] transition-all">
            Experience
          </a>
          <a href="#features" className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-full hover:bg-white/[0.06] transition-all">
            Features
          </a>
          <a href="#how-it-works" className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-full hover:bg-white/[0.06] transition-all">
            How it works
          </a>
          <a href="#restaurants" className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-full hover:bg-white/[0.06] transition-all">
            Directory
          </a>
          <a href="#pricing" className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-full hover:bg-white/[0.06] transition-all">
            Pricing
          </a>
          <a href="#contact" className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-full hover:bg-white/[0.06] transition-all">
            Contact
          </a>
        </nav>

        {/* Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/console/login"
            className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all border border-transparent hover:border-white/10"
          >
            Sign In
          </Link>
          <a
            href="#pricing"
            className="relative group px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 transform active:scale-95"
          >
            <span className="flex items-center gap-1.5">
              Get Started
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </span>
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}/>
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.08] bg-[#0c0c10] px-6 py-5 space-y-3">
          <a href="#showcase" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-orange-400 py-1">Experience</a>
          <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-orange-400 py-1">Features</a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-orange-400 py-1">How it works</a>
          <a href="#restaurants" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-orange-400 py-1">Directory</a>
          <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-orange-400 py-1">Pricing</a>
          <a href="#contact" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-orange-400 py-1">Contact</a>
          <div className="pt-4 border-t border-white/[0.06] flex flex-col gap-2.5">
            <Link href="/console/login" className="w-full text-center py-2.5 text-xs font-semibold text-zinc-200 bg-white/[0.05] rounded-lg border border-white/10">Sign in to console</Link>
            <a href="#pricing" className="w-full text-center py-2.5 text-xs font-semibold text-white bg-orange-500 rounded-lg shadow-lg shadow-orange-500/30">Create your restaurant</a>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── 3D Angled Carousel Hero ─────────────────────────────────────────────────
function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const totalSlides = AI_FEATURES.length;
  const duration = 4000;
  const isHoveredRef = useRef(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isHoveredRef.current) return;
      const elapsed = Date.now() - startTime;
      const p = Math.min(100, (elapsed % duration) / duration * 100);
      setProgress(p);

      if (elapsed % duration < 50) {
        setCurrentIndex((prev) => (prev + 1) % totalSlides);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [totalSlides]);

  const updateSlide = (idx: number) => {
    setCurrentIndex((idx + totalSlides) % totalSlides);
    setProgress(0);
  };

  return (
    <section className="relative pt-36 pb-24 md:pt-44 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-visible">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-radial from-orange-500/10 via-orange-500/3 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Hero Header */}
      <div className="text-center max-w-4xl mx-auto mb-14 md:mb-20 relative z-10">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-orange-500/20 backdrop-blur-md mb-8 shadow-inner shadow-orange-500/5">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          <span className="text-xs font-medium text-zinc-300">Next-Gen Restaurant Infrastructure</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
            v2.4 Live
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.05] mb-6">
          Your restaurant,<br />
          <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
            online in minutes.
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10 font-light">
          AI-powered website, booking assistant, menu scanner, and real-time staff dashboard. Purpose-built for dining venues that demand speed.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>Create Your Restaurant</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
          </Link>
          <a
            href="#showcase"
            className="w-full sm:w-auto px-7 py-4 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Explore Experience</span>
          </a>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
            </svg>
            <span>No credit card required</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
            </svg>
            <span>Setup in &lt; 3 minutes</span>
          </div>
        </div>
      </div>

      {/* 3D Angled Carousel */}
      <div
        id="showcase"
        className="relative max-w-6xl mx-auto mt-6 pt-4"
        onMouseEnter={() => { isHoveredRef.current = true; }}
        onMouseLeave={() => { isHoveredRef.current = false; }}
      >
        {/* Progress Bar Timer */}
        <div className="max-w-md mx-auto mb-6 flex items-center justify-between gap-3 px-4">
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="text-orange-400 font-bold">0{currentIndex + 1}</span>
            <span>/</span>
            <span>0{totalSlides}</span>
          </div>
        </div>

        {/* 3D Stage */}
        <div className="relative w-full h-[380px] sm:h-[480px] md:h-[580px] flex items-center justify-center select-none" style={{ perspective: "1400px" }}>
          {AI_FEATURES.map((feature, i) => {
            const diff = (i - currentIndex + totalSlides) % totalSlides;
            let transform = "translateX(0%) translateY(35px) scale(0.72) rotate(0deg)";
            let opacity = 0.2;
            let filter = "blur(2px)";
            let zIndex = 10;
            let pointerEvents: "auto" | "none" = "none";

            if (diff === 0) {
              // Active Center
              transform = "translateX(0%) translateY(0px) scale(1) rotate(0deg)";
              opacity = 1;
              filter = "blur(0px)";
              zIndex = 30;
              pointerEvents = "auto";
            } else if (diff === 1 || diff === -3) {
              // Right Card
              transform = "translateX(calc(48% + 20px)) translateY(15px) scale(0.86) rotate(3.5deg)";
              opacity = 0.65;
              filter = "blur(0.5px)";
              zIndex = 20;
              pointerEvents = "auto";
            } else if (diff === totalSlides - 1 || diff === -1) {
              // Left Card
              transform = "translateX(calc(-48% - 20px)) translateY(15px) scale(0.86) rotate(-3.5deg)";
              opacity = 0.65;
              filter = "blur(0.5px)";
              zIndex = 20;
              pointerEvents = "auto";
            }

            return (
              <div
                key={feature.id}
                onClick={() => diff !== 0 && updateSlide(i)}
                className="absolute w-[85%] sm:w-[70%] md:w-[62%] h-[320px] sm:h-[420px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl cursor-pointer border border-white/15 bg-zinc-900 transition-all duration-700 ease-out"
                style={{
                  transform,
                  opacity,
                  filter,
                  zIndex,
                  pointerEvents,
                }}
              >
                <div className="relative w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                  <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 flex items-end justify-between">
                    <div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold mb-2 border ${feature.badgeColor}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {feature.tag}
                      </div>
                      <h3 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 max-w-lg">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Carousel Navigation Buttons */}
        <div className="flex items-center justify-between mt-4 px-4 sm:px-8">
          <button
            onClick={() => updateSlide(currentIndex - 1)}
            aria-label="Previous Slide"
            className="p-3 rounded-full bg-white/[0.05] hover:bg-orange-500/20 text-zinc-300 hover:text-white border border-white/10 hover:border-orange-500/40 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {AI_FEATURES.map((feat, idx) => (
              <button
                key={feat.id}
                onClick={() => updateSlide(idx)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  idx === currentIndex
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : "bg-white/[0.05] text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {feat.tag.split(" ")[0]}
              </button>
            ))}
          </div>

          <button
            onClick={() => updateSlide(currentIndex + 1)}
            aria-label="Next Slide"
            className="p-3 rounded-full bg-white/[0.05] hover:bg-orange-500/20 text-zinc-300 hover:text-white border border-white/10 hover:border-orange-500/40 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Bento Grid Features ─────────────────────────────────────────────────────
function FeaturesSection() {
  const { ref, visible } = useReveal();

  return (
    <section id="features" className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-20">
        <p className="text-xs uppercase tracking-widest font-bold text-orange-400 mb-3">Engineered for Hospitality</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white mb-5">
          Everything runs on intelligent automation.
        </h2>
        <p className="text-zinc-400 text-base sm:text-lg">
          From conversational guest booking to instant OCR menu digitisation, Tablecraft replaces fragmented tooling with one cohesive hospitality engine.
        </p>
      </div>

      <div
        ref={ref}
        className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-1000 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: FeatureItem }) {
  const [open, setOpen] = useState(false);

  const icons: Record<string, React.ReactNode> = {
    chatbot: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    "menu-scanner": (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    "image-editor": (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    dashboard: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  };

  const styleMap = {
    orange: {
      borderHover: "hover:border-orange-500/40",
      iconBox: "bg-orange-500/15 border-orange-500/30 text-orange-400",
      tagText: "text-orange-400",
      pillBg: "bg-orange-500/10 text-orange-300 border-orange-500/20",
      chevron: "text-orange-400",
    },
    emerald: {
      borderHover: "hover:border-emerald-500/40",
      iconBox: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
      tagText: "text-emerald-400",
      pillBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      chevron: "text-emerald-400",
    },
    purple: {
      borderHover: "hover:border-purple-500/40",
      iconBox: "bg-purple-500/15 border-purple-500/30 text-purple-400",
      tagText: "text-purple-400",
      pillBg: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      chevron: "text-purple-400",
    },
    sky: {
      borderHover: "hover:border-sky-500/40",
      iconBox: "bg-sky-500/15 border-sky-500/30 text-sky-400",
      tagText: "text-sky-400",
      pillBg: "bg-sky-500/10 text-sky-300 border-sky-500/20",
      chevron: "text-sky-400",
    },
  };

  const s = styleMap[feature.color];

  return (
    <div className={`bg-[#0e0e12] border border-white/[0.08] rounded-2xl p-8 ${s.borderHover} transition-all duration-300`}>
      <div className="flex items-center gap-4 mb-5">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${s.iconBox}`}>
          {icons[feature.id]}
        </div>
        <div>
          <span className={`text-xs uppercase font-bold tracking-wider ${s.tagText}`}>{feature.tag}</span>
          <h3 className="font-display text-lg font-bold text-white mt-0.5">{feature.title}</h3>
        </div>
      </div>
      <p className="text-zinc-400 text-sm leading-relaxed mb-5">{feature.description}</p>
      <div className="flex flex-wrap gap-2 mb-6">
        {feature.tags.map((tag) => (
          <span key={tag} className={`px-2.5 py-1 rounded text-xs font-mono border ${s.pillBg}`}>
            {tag}
          </span>
        ))}
      </div>
      <div className="pt-4 border-t border-white/[0.08]">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
        >
          <span>{open ? "Show less" : "Show more"}</span>
          <svg
            className={`w-4 h-4 ${s.chevron} transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="mt-3 overflow-hidden transition-all duration-300">
            <div className="rounded-xl bg-black/60 border border-white/10 overflow-hidden">
              <div className="text-[11px] text-zinc-500 px-3 py-2 border-b border-white/[0.06] font-mono">
                {feature.previewName}
              </div>
              <div className="max-h-[380px] overflow-y-auto bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="w-full h-auto object-cover block"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    { n: "01", title: "Claim your restaurant URL", body: "Sign up, pick a name, and claim your public URL. AI suggests a tagline, color palettes, and creates your initial layout instantly.", highlight: "tablecraft.app/your-venue" },
    { n: "02", title: "Set up menu & visual styling", body: "Scan your printed menu with AI, generate hero images from prompts, or let our senior designer polish it for you.", highlight: "Automatic OCR mapping" },
    { n: "03", title: "Go live & accept guests", body: "Guests find you, book tables via the AI chatbot, and order online. You run everything from the staff dashboard.", highlight: "Live reservations active" },
  ];

  return (
    <section id="how-it-works" className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/[0.08]">
      <div className="text-center max-w-2xl mx-auto mb-20">
        <p className="text-xs uppercase tracking-widest font-bold text-orange-400 mb-3">Seamless Onboarding</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          Three steps. That&apos;s all.
        </h2>
        <p className="text-zinc-400 text-base">
          Go from idea to fully configured dining website in under five minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s, idx) => (
          <div key={s.n} className="bg-[#0c0c10] border border-white/[0.08] rounded-2xl p-8 hover:border-orange-500/40 transition-all group">
            <div className={`w-12 h-12 rounded-xl font-display font-extrabold text-xl flex items-center justify-center mb-6 shadow-md ${idx === 1 ? "bg-orange-500 text-white shadow-orange-500/20" : "bg-white text-black"}`}>
              {s.n}
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-3">{s.title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{s.body}</p>
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs font-mono text-orange-400">
              {s.highlight}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Live Directory Section ──────────────────────────────────────────────────
function RestaurantsSection() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("organizations")
          .select("id, name, slug, logo_url, theme_color, tagline")
          .order("created_at", { ascending: true });
        setOrgs(data ?? []);
      } catch {
        // Sample fallback
        setOrgs([
          { id: "1", name: "Lumina Bistro", slug: "lumina", theme_color: "#f97316", logo_url: null, tagline: "Contemporary Mediterranean & Grill" },
          { id: "2", name: "The Artisan Table", slug: "artisan-table", theme_color: "#d97706", logo_url: null, tagline: "Farm-to-Table Artisanal Bakery & Cafe" },
          { id: "3", name: "Kyoto Omakase", slug: "kyoto-omakase", theme_color: "#e11d48", logo_url: null, tagline: "Authentic Japanese Tasting Counter" },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  return (
    <section id="restaurants" className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/[0.08]">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-orange-400 mb-3">Live Network</p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
            Explore restaurants on Tablecraft
          </h2>
          <p className="text-zinc-400 text-base max-w-xl">
            See live restaurant portals powered by our platform across Dubai, Abu Dhabi, and beyond.
          </p>
        </div>
        <Link href="/restaurants" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-400 hover:text-orange-300 transition-colors">
          <span>View Full Directory</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-zinc-500 font-mono text-sm">Loading directory...</div>
      ) : orgs.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 font-mono text-sm">No restaurants registered yet. Be the first.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {orgs.map((org) => {
            const color = org.theme_color ?? "#f97316";
            return (
              <Link
                key={org.id}
                href={`/${org.slug}`}
                className="group bg-[#0e0e12] border border-white/[0.08] hover:border-orange-500/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 block"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-display font-bold text-xl group-hover:scale-105 transition-transform shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {org.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logo_url} alt={org.name} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      org.name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-display text-lg font-bold text-white group-hover:text-orange-400 transition-colors truncate">{org.name}</h4>
                    {org.tagline && <p className="text-xs text-zinc-400 truncate">{org.tagline}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400 pt-4 border-t border-white/[0.06]">
                  <span className="font-mono text-zinc-400">/{org.slug}</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live Menu
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Pricing Section ─────────────────────────────────────────────────────────
function PricingSection() {
  return (
    <section id="pricing" className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/[0.08]">
      <div className="text-center max-w-3xl mx-auto mb-20">
        <p className="text-xs uppercase tracking-widest font-bold text-orange-400 mb-3">Transparent Investment</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          Predictable plans. Zero surprises.
        </h2>
        <p className="text-zinc-400 text-base sm:text-lg">
          Start risk-free with a mock website and console. Upgrade when you&apos;re ready to launch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {PRICING.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-8 flex flex-col justify-between transition-all ${
              plan.highlighted
                ? "relative bg-gradient-to-b from-[#161311] to-[#0e0e12] border-2 border-orange-500/60 shadow-2xl shadow-orange-500/15 md:-translate-y-2"
                : "bg-[#0e0e12] border border-white/[0.08] hover:border-white/20"
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-orange-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-orange-500/40">
                Most Popular
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4 mt-1">
                <h3 className="font-display text-xl font-bold text-white">{plan.name}</h3>
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${plan.highlighted ? "bg-orange-500/20 text-orange-400" : "bg-white/[0.06] text-zinc-300"}`}>
                  {plan.highlighted ? "Live Site" : "Tier"}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                <span className="font-display text-4xl sm:text-5xl font-extrabold text-white">{plan.price}</span>
                <span className="text-sm font-semibold text-zinc-400">AED</span>
                {plan.priceTag && (
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-md border ${
                    plan.highlighted
                      ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}>
                    {plan.priceTag}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mb-6">
                {plan.priceTag ? "Setup fee + monthly AI & cloud compute" : "No credit card required"}
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">{plan.description}</p>

              <div className="space-y-3 pt-6 border-t border-white/[0.06] mb-8">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-xs text-zinc-300">
                    <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href={plan.ctaLink}
              className={`w-full py-4 rounded-xl text-xs font-bold text-center transition-all ${
                plan.highlighted
                  ? "text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-xl shadow-orange-500/30"
                  : "text-zinc-200 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Contact Form ────────────────────────────────────────────────────────────
function ContactSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
    } catch {
      // simulate fallback
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/[0.08]">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <p className="text-xs uppercase tracking-widest font-bold text-orange-400 mb-3">Direct Inquiries</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
          Questions? Custom setups?
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base">
          Whether you are an independent dining room, hospitality group, or developer, we&apos;d love to connect.
        </p>
      </div>

      <div className="bg-[#0e0e12] border border-white/[0.08] rounded-2xl p-8 sm:p-10 shadow-2xl">
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h4 className="font-display text-2xl font-bold text-white mb-2">Message Dispatched!</h4>
            <p className="text-zinc-400 text-sm max-w-sm mx-auto mb-6">
              Thank you, {name}. Our hospitality team will review your inquiry and follow up promptly.
            </p>
            <button
              onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); }}
              className="px-6 py-2.5 rounded-lg text-xs font-semibold text-zinc-300 bg-white/[0.05] border border-white/10 hover:bg-white/10"
            >
              Send another note
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-2">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Chef or Restaurateur"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-orange-500 focus:outline-none text-white text-sm rounded-xl px-4 py-3.5 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  className="w-full bg-zinc-900 border border-white/10 focus:border-orange-500 focus:outline-none text-white text-sm rounded-xl px-4 py-3.5 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-2">Message or Venue Details</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your restaurant concept, seating capacity, or custom requirements..."
                className="w-full bg-zinc-900 border border-white/10 focus:border-orange-500 focus:outline-none text-white text-sm rounded-xl px-4 py-3.5 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-xl shadow-orange-500/25 transition-all disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── Main Mock Page Component ────────────────────────────────────────────────
export default function MockLandingPage() {
  return (
    <div className="min-h-screen bg-[#060607] text-zinc-100 selection:bg-orange-500 selection:text-white">
      <Navbar />
      <Hero />
      <FeaturesSection />
      <HowItWorksSection />
      <RestaurantsSection />
      <PricingSection />
      <ContactSection />

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#050507] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
              <svg viewBox="0 0 200 200" className="w-5 h-5 text-white" fill="currentColor">
                <g transform="translate(100, 100)">
                  <g transform="rotate(45)">
                    <path d="M-5 15 L-5 70 C-5 74 -1 78 0 78 C1 78 5 74 5 70 L5 15 Z"/>
                    <path d="M-6 15 C-6 5 -12 -5 -14 -15 L14 -15 C12 -5 6 15 6 15 Z"/>
                    <path d="M-14 -15 L-14 -55 C-14 -58 -10 -58 -10 -55 L-10 -25 C-10 -20 -8 -20 -8 -25 L-8 -55 C-8 -58 -4 -58 -4 -55 L-4 -25 C-4 -20 4 -20 4 -25 L4 -55 C4 -58 8 -58 8 -55 L8 -25 C8 -20 10 -20 10 -25 L10 -55 C10 -58 14 -58 14 -55 L14 -15 Z"/>
                  </g>
                  <g transform="rotate(-45)">
                    <path d="M-5 15 L-5 70 C-5 74 -1 78 0 78 C1 78 5 74 5 70 L5 15 Z"/>
                    <ellipse cx="0" cy="-36" rx="20" ry="28"/>
                  </g>
                </g>
              </svg>
            </div>
            <span className="font-display font-bold text-lg text-white">Tablecraft</span>
            <span className="text-xs text-zinc-400 font-mono">· Hospitality OS</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400 font-medium">
            <a href="#showcase" className="hover:text-white transition-colors">Experience</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#restaurants" className="hover:text-white transition-colors">Directory</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            <Link href="/console/login" className="hover:text-white transition-colors">Console Login</Link>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Systems 100% Operational</span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/[0.04] text-center text-xs text-zinc-400">
          © 2026 Tablecraft. Built for restaurants that want to move fast.
        </div>
      </footer>
    </div>
  );
}
