"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/PasswordInput";

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

    try {
      const res = await fetch("/api/signup-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create account");
        return;
      }

      // Account created — redirect to sign-in
      try {
        router.push("/signin?info=account-created");
      } catch {
        setError("Account created, but navigation failed — please go to Sign in manually.");
      }
    } catch {
      setError("Network error — could not create account. Check connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white text-neutral-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-2">
          <Link href="/" className="font-display text-2xl tracking-tight text-neutral-950">
            Tablecraft
          </Link>
        </div>

        {/* Mini rectangle with leaf background texture */}
        <div>
          <div className="relative">
            <div className="rounded-3xl bg-neutral-100 border border-black p-8 space-y-6">
              <div className="text-center">
                <h1 className="font-display text-xl mb-1">Create your Tablecraft account</h1>
                <p className="text-sm text-neutral-600">
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
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                    Password
                  </label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    At least 8 characters.
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 rounded-2xl bg-red-50 px-3 py-2" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#d45200] text-white text-[16px] font-semibold px-7 py-4 hover:bg-[#b54600] transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating account…" : "Create account"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-neutral-500 space-x-2">
          <Link href="/" className="hover:text-neutral-950 transition-colors">
            ← Back to Tablecraft
          </Link>
          <span className="text-neutral-500">·</span>
          <Link href="/signin" className="hover:text-neutral-950 transition-colors">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
