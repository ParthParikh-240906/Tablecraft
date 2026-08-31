"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tagline, setTagline] = useState("");
  
  // Optional fields
  const [branches, setBranches] = useState<string[]>([""]);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [restaurantImageFile, setRestaurantImageFile] = useState<File | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Auto-suggest a slug from the org name.
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

  const [slugTouched, setSlugTouched] = useState(false);
  
  // Handler for branches array
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
    setSubmitting(true);
    setUploading(true);

    try {
      // Filter out empty branches
      const validBranches = branches.filter(b => b.trim().length > 0);
      
      // Prepare form data for file uploads
      const formData = new FormData();
      formData.append('orgName', orgName);
      formData.append('slug', slug);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('tagline', tagline);
      
      // Optional fields
      if (validBranches.length > 0) {
        formData.append('branches', JSON.stringify(validBranches));
      }
      if (contactPhone) formData.append('contactPhone', contactPhone);
      if (contactEmail) formData.append('contactEmail', contactEmail);
      if (contactAddress) formData.append('contactAddress', contactAddress);
      if (aboutText) formData.append('aboutText', aboutText);
      if (logoFile) formData.append('logoFile', logoFile);
      if (restaurantImageFile) formData.append('restaurantImageFile', restaurantImageFile);

      const res = await fetch("/api/signup", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create your restaurant");
        setSubmitting(false);
        setUploading(false);
        return;
      }

      // Success: send them to their new public site.
      router.push(`/${data.org.slug}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--paper)] text-[var(--ink)]">
      <div className="w-full max-w-md mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-sans tracking-widest uppercase font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
        >
          ← Back to Tablecraft
        </Link>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="label-caps text-[color:var(--accent)] mb-1">
            Tablecraft
          </p>
          <h1 className="font-display text-3xl text-[var(--ink)]">Create your restaurant</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-2">
            Get a public menu, reservations, and online ordering.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="ticket p-6 space-y-5"
        >
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
              className="input placeholder:text-[var(--ink-faint)]"
            />
          </div>

          <div>
            <label htmlFor="tagline" className="block text-sm font-medium mb-1.5">
              Tagline (optional)
            </label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={120}
              placeholder="Fresh food, warm welcome."
              className="input placeholder:text-[var(--ink-faint)]"
            />
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              A short one-line tagline displayed on your landing page.
            </p>
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium mb-1.5">
              Your public URL
            </label>
            <div className="flex items-center input">
              <span className="text-[var(--ink-faint)] select-none mr-1">/</span>
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
                className="flex-1 bg-transparent text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none"
              />
            </div>
            <p className="text-xs text-[var(--ink-faint)] mt-1">
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
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@restaurant.com"
              className="input placeholder:text-[var(--ink-faint)]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input placeholder:text-[var(--ink-faint)]"
            />
            <p className="text-xs text-[var(--ink-faint)] mt-1">
              At least 8 characters. You'll use this to sign in to your console.
            </p>
          </div>

          {/* Optional fields section */}
          <div className="border-t border-[var(--rule)] pt-4 space-y-4">
            <p className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wide">
              Optional Details
            </p>

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
                    className="input flex-1 placeholder:text-[var(--ink-faint)]"
                  />
                  {branches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBranch(index)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addBranch}
                className="text-xs text-[var(--accent)] hover:underline"
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
                  className="input placeholder:text-[var(--ink-faint)]"
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
                  className="input placeholder:text-[var(--ink-faint)]"
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
                  placeholder="123 Main St, City"
                  className="input placeholder:text-[var(--ink-faint)]"
                />
              </div>
            </div>

            {/* About text */}
            <div>
              <label htmlFor="aboutText" className="block text-sm font-medium mb-1.5">
                About your restaurant (optional)
              </label>
              <textarea
                id="aboutText"
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                rows={4}
                placeholder="Tell us about your restaurant's story, cuisine, and atmosphere..."
                className="input placeholder:text-[var(--ink-faint)]"
              />
              <p className="text-xs text-[var(--ink-faint)] mt-1">
                This will be displayed on your landing page's About section.
              </p>
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
                  className="input"
                />
              </div>
               <div>
                <label htmlFor="restaurantImageFile" className="block text-sm font-medium mb-1.5">
                  Restaurant photo (optional)
                </label>
                <input
                  id="restaurantImageFile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRestaurantImageFile(e.target.files?.[0] || null)}
                  className="input"
                />
                <p className="text-xs text-[var(--ink-faint)] mt-1">
                  A photo of your restaurant interior or food. Displayed on the landing page.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 rounded-sm bg-red-900/40 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-accent w-full"
          >
            {submitting ? "Creating…" : "Create restaurant"}
          </button>

          <p className="text-xs text-center text-[var(--ink-faint)]">
            Already have an account?{" "}
            <Link href="/console/login" className="underline hover:text-[var(--ink)]">
              Sign in to your console
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}