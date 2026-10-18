"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const info = searchParams.get("info");
  const authErrorParam = searchParams.get("error");
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    authErrorParam === "auth_callback_failed"
      ? "Google sign-in failed. Please try again."
      : authErrorParam === "magiclink_failed"
        ? "That sign-in link expired or is invalid. Please try again."
        : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        const msg = /rate.?limit|too many/i.test(authError.message)
          ? "Too many attempts. Please wait a minute and try again."
          : "Invalid email or password. Please try again.";
        setError(msg);
        return;
      }

      try {
        router.push(next);
        router.refresh();
      } catch {
        setError("Signed in, but navigation failed — please retry.");
      }
    } catch {
      setError("Network error — could not sign in. Check connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                },
      });

      if (error) {
        setError("Google sign-in failed. Please try again.");
      }
    } catch {
      setError("Network error — Google sign-in failed. Try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white text-neutral-950">
      <a href="#signin-form" className="skip-link">Skip to sign in</a>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-2">
          <Link href="/" className="font-display text-2xl tracking-tight text-neutral-950">
            Tablecraft
          </Link>
        </div>

        {/* Mini rectangle with leaf background texture */}
        <div id="signin-form">
          <div className="relative">
            <div className="rounded-3xl bg-neutral-100 border border-black p-8 space-y-6">
              <div className="text-center">
                <h1 className="font-display text-xl mb-1">Sign in to Tablecraft</h1>
                <p className="text-sm text-neutral-600">
                  {next.startsWith("/restaurants/create") ? "Sign in to set up your restaurant" : "Access your dashboard and restaurants"}
                </p>
                {info === "account-created" && (
                  <p className="text-sm text-green-700 mt-2 bg-green-50 rounded-2xl px-3 py-1.5">
                    Account created! Sign in with your email and password.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || submitting}
                className="w-full rounded-full border border-black bg-white text-neutral-950 text-[16px] font-semibold px-7 py-4 hover:bg-neutral-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z" />
                  <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z" />
                </svg>
                Continue with Google
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-neutral-200" />
                <span className="flex-shrink mx-3 text-[11px] text-neutral-500 uppercase tracking-wider">
                  Or
                </span>
                <div className="flex-grow border-t border-neutral-200" />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-950 outline-none focus:border-black transition-colors placeholder:text-neutral-400"
                  />
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
                  {submitting ? "Signing in…" : "Sign in with Email"}
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
          <Link href="/signup" className="hover:text-neutral-950 transition-colors">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-sm text-neutral-500">Loading…</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
