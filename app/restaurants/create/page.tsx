"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

export default function CreateRestaurantPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [consolePassword, setConsolePassword] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [branches, setBranches] = useState<string[]>([""]);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroMobileFile, setHeroMobileFile] = useState<File | null>(null);
  const [restaurantImages, setRestaurantImages] = useState<File[]>([]);
  const [vibe, setVibe] = useState("");
  const [templates, setTemplates] = useState<"professional" | "attention-seeking" | "">("");
  const [createdOrg, setCreatedOrg] = useState<{ id: string; slug: string } | null>(null);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "max" | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [buildStage, setBuildStage] = useState<"creating" | "building" | "finalizing" | null>(null);
  const [buildFailed, setBuildFailed] = useState(false);

  // Read ?plan= query param on mount
  useEffect(() => {
    const plan = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("plan");
    if (plan === "pro" || plan === "max") {
      setSelectedPlan(plan);
    }
  }, []);

  // Lock email to session user on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        setError("Could not verify your sign-in — please refresh and try again.");
        return;
      }
      if (user) setEmail(user.email ?? "");
    }).catch(() => {
      setError("Could not verify your sign-in — please refresh and try again.");
    });
  }, []);

  function handleNameChange(value: string) {
    setOrgName(value);
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40),
      );
    }
  }

  function handleBranchChange(index: number, value: string) {
    const newBranches = [...branches];
    newBranches[index] = value;
    setBranches(newBranches);
  }

  function addBranch() {
    setBranches([...branches, ""]);
  }

  function removeBranch(index: number) {
    setBranches(branches.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vibe.trim()) {
      setError("Please describe the vibe / aesthetic — it is required for the website build.");
      return;
    }
    if (!templates) {
      setError("Please choose a template — Professional or Attention seeking.");
      return;
    }
    setSubmitting(true);
    setUploading(true);
    setBuildFailed(false);
    setBuildStage("creating");

    try {
      const validBranches = branches.filter(b => b.trim().length > 0);

      const formData = new FormData();
      formData.append('orgName', orgName);
      formData.append('slug', slug);
      formData.append('email', email);
      // Password is empty — session auth handles the auth user
      formData.append('password', '');
      formData.append('tagline', tagline);
      if (consolePassword) formData.append('consolePassword', consolePassword);
      formData.append('staffEmail', staffEmail);
      formData.append('staffPassword', staffPassword);
      formData.append('aboutText', aboutText);
      if (selectedPlan) formData.append('intendedPlan', selectedPlan);

      if (validBranches.length > 0) {
        formData.append('branches', JSON.stringify(validBranches));
      }
      if (contactPhone) formData.append('contactPhone', contactPhone);
      if (contactEmail) formData.append('contactEmail', contactEmail);
      if (contactAddress) formData.append('contactAddress', contactAddress);
      if (logoFile) formData.append('logoFile', logoFile);
      if (heroFile) formData.append('heroFile', heroFile);
      if (heroMobileFile) formData.append('heroMobileFile', heroMobileFile);
      if (restaurantImages.length > 0) restaurantImages.forEach((f) => formData.append('restaurantImageFiles', f));

      const res = await fetch("/api/signup", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create your restaurant");
        setSubmitting(false);
        setUploading(false);
        setBuildStage(null);
        return;
      }

      // Kick off Haiku 5.5 (medium effort) initial website build. Non-blocking:
      // combine/edit + tests run against the created org even if this fails.
      setBuildStage("building");
      try {
        const buildRes = await fetch("/api/ai/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: data?.org?.id,
            name: orgName,
            tagline,
            orgSlug: data?.org?.slug ?? slug,
            vibe,
            templates,
            paragraph: aboutText,
            branches: validBranches,
            contactPhone,
            contactEmail,
            contactAddress,
            logoUrl: data?.org?.logo_url ?? undefined,
            heroUrl: data?.org?.hero_url ?? data?.org?.background_image_url ?? undefined,
            heroMobileUrl: data?.org?.hero_mobile_url ?? data?.org?.mobile_background_image_url ?? undefined,
            imageUrls: data?.org?.restaurant_photos ?? undefined,
          }),
        });
        if (!buildRes.ok) {
          setBuildFailed(true);
        } else {
          const buildData = await buildRes.json().catch(() => null);
          if (typeof buildData?.html !== "string" || buildData.html.length === 0) setBuildFailed(true);
        }
      } catch {
        // Build failures do not block signup; don't block signup.
        setBuildFailed(true);
      }
      // "Connecting" runs inside /api/ai/build (verifyAndFixSiteHtml), so hold
      // the finalizing stage for a visible beat — otherwise React batches
      // setBuildStage("finalizing") + setBuildStage(null) and it never paints.
      setBuildStage("finalizing");
      await new Promise((r) => setTimeout(r, 1500));

      // Restaurant exists — move to the payments step (Connect is optional).
      setCreatedOrg({ id: data?.org?.id, slug: data?.org?.slug ?? slug });
      setSubmitting(false);
      setUploading(false);
      setBuildStage(null);
      return;
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
      setUploading(false);
      setBuildStage(null);
    }
  }

  async function connectStripe() {
    if (connecting || !createdOrg) return;
    setConnecting(true);
    setConnectError(null);

    // Open the popup synchronously inside the click gesture; browsers block
    // window.open() calls made after an await. Navigate it once we have a URL.
    const popup = window.open("", "stripe-connect", "width=600,height=800");
    if (!popup) {
      setConnecting(false);
      setConnectError("Popup blocked — allow popups and try again.");
      return;
    }

    try {
      const res = await fetch("/api/stripe/connect/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug: createdOrg.slug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        popup.close();
        setConnectError(data?.error ?? "Could not start Stripe onboarding.");
        return;
      }
      popup.location.href = data.url;
      const onMessage = (e: MessageEvent) => {
        if (e.data === "stripe-connected") refreshConnectStatus();
      };
      window.addEventListener("message", onMessage);
      for (let i = 0; i < 100 && !popup.closed; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        await refreshConnectStatus();
        if (!popup.closed) continue;
        break;
      }
      window.removeEventListener("message", onMessage);
      await refreshConnectStatus();
    } catch {
      try {
        popup.close();
      } catch {}
      setConnectError("Network error — please try again.");
    } finally {
      setConnecting(false);
    }
  }

  async function refreshConnectStatus() {
    if (!createdOrg) return;
    try {
      const res = await fetch(`/api/stripe/connect/status?orgSlug=${encodeURIComponent(createdOrg.slug)}`);
      const data = await res.json().catch(() => null);
      if (data?.status) setConnectStatus(data.status);
    } catch {}
  }

  async function continueAfterCreate() {
    if (!createdOrg) return;
    if (selectedPlan) {
      setRedirecting(true);
      try {
        const res = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selectedPlan, email, orgSlug: createdOrg.slug }),
        });
        const checkoutData = await res.json().catch(() => null);
        if (!res.ok) {
          setError(checkoutData?.error ?? "Payment setup failed — your restaurant was created, but checkout did not start. Continue from the dashboard.");
          setRedirecting(false);
          router.push("/dashboard");
          router.refresh();
          return;
        }
        if (checkoutData?.url) {
          window.location.href = checkoutData.url;
          return;
        }
        setError("Payment setup did not return a checkout link — continue from the dashboard.");
        setRedirecting(false);
      } catch {
        setError("Payment setup failed — your restaurant was created. Continue from the dashboard to retry payment.");
        setRedirecting(false);
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-white text-neutral-950">
      {submitting && buildStage && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Creating your restaurant"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-white/95 text-neutral-950"
        >
          <style>{`@keyframes tc-load-slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }`}</style>
          <div className="flex flex-col items-center rounded-3xl bg-neutral-100 border border-black px-10 py-10 w-full max-w-sm">
          <p className="font-display text-[22px] tracking-tight">Tablecraft</p>
          <div
            className="mt-4 h-10 w-10 rounded-full border-2 border-[#d45200] border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <p className="mt-4 text-[15px] font-medium">
            {buildStage === "creating" && "Creating your restaurant…"}
            {buildStage === "building" && "Building your website with AI…"}
            {buildStage === "finalizing" && "Connecting to console…"}
          </p>
          <p className="mt-1 text-xs text-neutral-500 text-center">
            {buildStage === "building"
              ? "Building your site and connecting it to the console — usually a few minutes. Hang tight."
              : "This only takes a moment."}
          </p>
          {/* Indeterminate progress bar */}
          <div
            className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
            aria-hidden="true"
          >
            <div
              className="h-full w-1/3 rounded-full bg-[#d45200]"
              style={{ animation: "tc-load-slide 1.4s ease-in-out infinite" }}
            />
          </div>
          {/* Stage checklist */}
          <ul className="mt-6 space-y-1.5 text-xs text-neutral-600" aria-hidden="true">
            {(
              [
                ["creating", "Creating restaurant"],
                ["building", "Building website with AI"],
                ["finalizing", "Connecting to console"],
              ] as const
            ).map(([stage, label]) => {
              const order = { creating: 0, building: 1, finalizing: 2 } as const;
              const done = order[buildStage] > order[stage];
              const active = buildStage === stage;
              return (
                <li key={stage} className="flex items-center gap-2">
                  <span className={done ? "text-[#d45200]" : active ? "text-neutral-950" : "text-neutral-400"}>
                    {done ? "✓" : active ? "●" : "○"}
                  </span>
                  <span className={active ? "text-neutral-950 font-semibold" : undefined}>{label}</span>
                </li>
              );
            })}
          </ul>
          </div>
        </div>
      )}
      <div className="w-full max-w-md mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-xs font-sans tracking-widest uppercase font-medium text-neutral-500 hover:text-neutral-950 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="w-full max-w-md">
        {!createdOrg && (
        <>
        <div className="text-center mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#d45200] mb-1">Tablecraft</p>
          <h1 className="font-display text-3xl text-neutral-950">Create your restaurant</h1>
          {selectedPlan && (
            <p className="text-sm text-neutral-600 mt-2">
              You&apos;re signing up for the <span className="font-semibold text-[#d45200]">{selectedPlan === "pro" ? "Pro" : "Max"}</span> plan — payment required to activate.
            </p>
          )}
          <p className="text-sm text-neutral-600 mt-2">
            Get a public menu, reservations, and online ordering.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-neutral-100 border border-black p-6 space-y-5">
          <div>
            <label htmlFor="orgName" className="block text-sm font-medium mb-1.5">
              Restaurant name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              minLength={2}
              placeholder="Bella Napoli"
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
            />
          </div>

          <div>
            <label htmlFor="tagline" className="block text-sm font-medium mb-1.5">
              Tagline <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={120}
              placeholder="Fresh food, warm welcome."
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
            />
            <p className="text-xs text-neutral-500 mt-1">
              A short one-line tagline displayed on your landing page.
            </p>
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium mb-1.5">
              Your public URL
            </label>
            <div className="w-full flex items-center rounded-2xl border border-neutral-300 bg-white px-4 py-3 focus-within:border-black transition-colors">
              <span className="text-neutral-500 select-none mr-1">/</span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                required
                pattern="[a-z0-9-]{2,40}"
                placeholder="bella-napoli"
                className="flex-1 bg-transparent text-neutral-950 placeholder:text-neutral-400 outline-none"
              />
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Owner email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              placeholder="you@restaurant.com"
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors opacity-70 cursor-not-allowed bg-neutral-100"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Locked to your signed-in account.
            </p>
          </div>

          <div>
            <label htmlFor="consolePassword" className="block text-sm font-medium mb-1.5">
              Console Password <span className="text-neutral-500 font-normal">(optional)</span>
            </label>
            <PasswordInput
              id="consolePassword"
              value={consolePassword}
              onChange={(e) => setConsolePassword(e.target.value)}
              minLength={8}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Optional separate password for the console. If set, you can log into the console with this password independently.
            </p>
          </div>

          {/* ── Staff Account Section ── */}
          <div className="border-t border-neutral-200 pt-5 mt-2">
            <p className="text-sm font-medium mb-3">
              Staff Account <span className="text-[#d45200]">*</span>
            </p>
            <p className="text-xs text-neutral-500 mb-4">
              A staff account is required for your restaurant team to access the console.
            </p>

            <div>
              <label htmlFor="staffEmail" className="block text-sm font-medium mb-1.5">
                Staff email / Restaurant email
              </label>
              <input
                id="staffEmail"
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                required
                placeholder="staff@restaurant.com"
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
              />
            </div>

            <div className="mt-3">
              <label htmlFor="staffPassword" className="block text-sm font-medium mb-1.5">
                Staff password
              </label>
              <PasswordInput
                id="staffPassword"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
              />
              <p className="text-xs text-neutral-500 mt-1">
                At least 8 characters. Used by staff to sign in to the console.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="vibe" className="block text-sm font-medium mb-1.5">
              Vibe / aesthetic <span className="text-[#d45200]">*</span>
            </label>
            <input
              id="vibe"
              type="text"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              required
              maxLength={200}
              placeholder="Cozy Italian trattoria, warm lights, rustic wood"
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Required — the build model applies this first.
            </p>
          </div>

          <div>
            <p id="templates-label" className="block text-sm font-medium mb-1.5">
              Template <span className="text-[#d45200]">*</span>
            </p>
            <div role="radiogroup" aria-labelledby="templates-label" className="grid grid-cols-2 gap-3">
              {(
                [
                  ["professional", "Professional", "Calm, editorial, clean"],
                  ["attention-seeking", "Attention seeking", "Bold, kinetic, creative"],
                ] as const
              ).map(([value, label, hint]) => {
                const selected = templates === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTemplates(value)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-[#d45200] bg-orange-50"
                        : "border-neutral-300 bg-white hover:border-neutral-950"
                    }`}
                  >
                    <span className="block text-[15px] font-semibold text-neutral-950">{label}</span>
                    <span className="block text-xs text-neutral-500 mt-0.5">{hint}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Required — picks the website style the build model follows.
            </p>
          </div>

          {/* Optional details dropdown */}
          <details className="border-t border-neutral-200 pt-4">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-600 uppercase tracking-wide hover:text-neutral-950 transition-colors py-1 select-none">
              Optional Details
            </summary>
            <div className="space-y-4 pt-4">
              <div>
                <label htmlFor="aboutText" className="block text-sm font-medium mb-1.5">
                  About / story <span className="text-neutral-500">(optional — owner paragraph)</span>
                </label>
                <textarea
                  id="aboutText"
                  value={aboutText}
                  onChange={(e) => setAboutText(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Your story, cuisine, and atmosphere — used as the owner paragraph on the site..."
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  If filled, the build model must use it. If empty, it writes one for you.
                </p>
              </div>
              {/* Branches */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Branches / Locations (optional)
                </label>
                {branches.map((branch, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => handleBranchChange(index, e.target.value)}
                      placeholder="Abu Dhabi"
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors flex-1 placeholder:text-neutral-400"
                    />
                    {branches.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBranch(index)}
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBranch}
                  className="text-xs text-[#d45200] hover:underline"
                >
                  + Add another location
                </button>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="contactPhone" className="block text-sm font-medium mb-1.5">
                    Phone (optional)
                  </label>
                  <input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+971 2 123 4567"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label htmlFor="contactEmail" className="block text-sm font-medium mb-1.5">
                    Contact email (optional)
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="info@restaurant.com"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label htmlFor="contactAddress" className="block text-sm font-medium mb-1.5">
                    Address (optional)
                  </label>
                  <input
                    id="contactAddress"
                    type="text"
                    value={contactAddress}
                    onChange={(e) => setContactAddress(e.target.value)}
                    placeholder="123 Main St, Dubai"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {/* File uploads */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="logoFile" className="block text-sm font-medium mb-1.5">
                    Logo image (optional)
                  </label>
                  <input
                    id="logoFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="heroFile" className="block text-sm font-medium mb-1.5">
                    Hero image (optional)
                  </label>
                  <input
                    id="heroFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setHeroFile(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Shown in the website hero section on desktop and tablet. Also saved to your console
                    Image Gallery so you can reuse it in edits. Gallery photos are never reused for the hero.
                  </p>
                </div>
                <div>
                  <label htmlFor="heroMobileFile" className="block text-sm font-medium mb-1.5">
                    Hero image for mobile (optional)
                  </label>
                  <input
                    id="heroMobileFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setHeroMobileFile(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Shown on phones (720px and below) instead of the desktop hero. Also saved to your
                    console Image Gallery. If left empty, mobile gets the CSS-art hero.
                  </p>
                </div>
                <div>
                  <label htmlFor="restaurantImages" className="block text-sm font-medium mb-1.5">
                    Restaurant photos (optional)
                  </label>
                  <input
                    id="restaurantImages"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setRestaurantImages(Array.from(e.target.files ?? []))}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Upload one or more photos for the gallery. If you skip this, your hero image becomes
                    the single gallery fallback tile so the gallery is never empty.
                  </p>
                </div>
              </div>
            </div>
          </details>

          {error && (
            <p className="text-sm text-red-600 rounded-2xl bg-red-50 px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || redirecting || uploading}
            className="w-full rounded-full bg-[#d45200] text-white text-[16px] font-semibold px-7 py-4 hover:bg-[#b54600] transition-colors disabled:opacity-50"
          >
            {submitting
              ? "Creating restaurant…"
              : redirecting
                ? "Redirecting to payment…"
                : "Create restaurant"}
          </button>
        </form>
        </>
        )}

        {createdOrg && (
          <div className="rounded-3xl bg-neutral-100 border border-black p-6 space-y-4 mt-6">
            <h2 className="font-display text-xl">Accept online payments</h2>
            {buildFailed && (
              <p className="text-xs rounded-sm border border-[#d45200]/30 bg-orange-50 rounded-2xl p-3 text-[#b54600]">
                The AI website build hit a snag — your restaurant was still created. Our team will finish the website setup, or contact support if it is still missing after a few minutes.
              </p>
            )}
            <p className="text-sm text-neutral-600">
              {createdOrg.slug} is created. Connect Stripe to take guest cart payments — a popup opens where you create a new Stripe account or sign into your existing one.
            </p>
            {connectStatus === "active" ? (
              <p className="text-sm text-green-700">✓ Stripe connected — cart checkout is live.</p>
            ) : (
              <button
                type="button"
                onClick={connectStripe}
                disabled={connecting}
                className="w-full rounded-full bg-[#d45200] text-white text-[16px] font-semibold px-7 py-4 hover:bg-[#b54600] transition-colors disabled:opacity-50"
              >
                {connecting ? "Waiting for Stripe…" : "Connect Stripe"}
              </button>
            )}
            {connectError && <p className="text-xs text-red-600">{connectError}</p>}
            <button
              type="button"
              onClick={continueAfterCreate}
              disabled={redirecting}
              className="w-full rounded-full border border-black bg-white text-neutral-950 text-[16px] font-semibold px-7 py-4 hover:bg-neutral-100 transition-colors disabled:opacity-50"
            >
              {connectStatus === "active" ? "Continue" : "Skip for now"}
            </button>
          </div>
        )}

        <p className="text-xs text-center text-neutral-500 mt-4">
          <Link href="/" className="hover:text-neutral-950 transition-colors">
            ← Back to Tablecraft
          </Link>
        </p>
      </div>
    </div>
  );
}
