"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/signup-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create account");
      setSubmitting(false);
      return;
    }

    // Account created — redirect to sign-in
    router.push("/signin?info=account-created");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-2">
          <Link href="/" className="font-display text-2xl tracking-tight text-[var(--ink)]">
            Tablecraft
          </Link>
        </div>

        {/* Mini rectangle with leaf background texture */}
        <div className="layer2-bg border border-white rounded-sm overflow-hidden">
          <div className="relative">
            <div className="ticket ticket--dark p-8 space-y-6">
              <div className="text-center">
                <h1 className="font-display text-xl mb-1">Create your Tablecraft account</h1>
                <p className="text-sm text-[var(--ink-soft)]">
                  You&apos;ll set up your restaurant after signing in.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                    Email
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
                    placeholder="••••••••"
                    className="input placeholder:text-[var(--ink-faint)]"
                  />
                  <p className="text-xs text-[var(--ink-faint)] mt-1">
                    At least 8 characters.
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-400 rounded-sm bg-red-900/40 px-3 py-2" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-accent w-full"
                >
                  {submitting ? "Creating account…" : "Create account"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-[var(--ink-faint)] space-x-2">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">
            ← Back to Tablecraft
          </Link>
          <span className="text-[var(--ink-faint)]">·</span>
          <Link href="/signin" className="hover:text-[var(--ink)] transition-colors">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
