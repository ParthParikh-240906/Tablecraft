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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, slug, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create your restaurant");
        setSubmitting(false);
        return;
      }

      // Success: send them to their new public site.
      router.push(`/${data.org.slug}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-orange-500 font-semibold mb-1">
            Tablecraft
          </p>
          <h1 className="text-2xl font-bold">Create your restaurant</h1>
          <p className="text-sm text-gray-500 mt-1">
            Get a public menu, reservations, and online ordering.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl border p-6">
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
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium mb-1.5">
              Your public URL
            </label>
            <div className="flex items-center rounded-lg border px-3 py-2.5 text-sm">
              <span className="text-gray-400 select-none">/</span>
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
                className="flex-1 outline-none ml-0.5"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
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
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
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
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              At least 8 characters. You'll use this to sign in to your console.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-full bg-orange-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create restaurant"}
          </button>

          <p className="text-xs text-center text-gray-400">
            Already have an account?{" "}
            <Link href="/console/login" className="underline">
              Sign in to your console
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}