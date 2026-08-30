"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = searchParams.get("org");
  const next = searchParams.get("next") ?? "/console/tables";

  const [email, setEmail] = useState(orgSlug === "rasam" ? "owner@rasam.test" : orgSlug === "demo-diner" ? "owner@demodiner.test" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="ticket p-6 space-y-5">
      {orgSlug && (
        <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-sm px-3 py-2 text-xs">
          <p className="font-semibold text-[var(--accent)]">
            Logging in for: {orgSlug}
          </p>
        </div>
      )}

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
          placeholder="••••••••"
          className="input placeholder:text-[var(--ink-faint)]"
        />
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
        {submitting ? "Signing in…" : "Sign in with Email"}
      </button>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-[var(--rule)]"></div>
        <span className="flex-shrink mx-3 text-[11px] text-[var(--ink-faint)] uppercase tracking-wider">
          Or
        </span>
        <div className="flex-grow border-t border-[var(--rule)]"></div>
      </div>

      <button
        type="button"
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
        }}
        className="btn btn-outline w-full flex items-center justify-center gap-2 text-xs font-medium"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
          />
          <path
            fill="#FBBC05"
            d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"
          />
          <path
            fill="#34A853"
            d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
          />
        </svg>
        Continue with Google
      </button>

      <p className="text-xs text-center text-[var(--ink-faint)] pt-1">
        New restaurant?{" "}
        <Link href="/signup" className="underline text-[var(--ink)]">
          Create your account
        </Link>
      </p>
    </form>
  );
}

export default function ConsoleLoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--paper)] text-[var(--ink)]">
      <div className="w-full max-w-sm mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-sans tracking-widest uppercase font-medium text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
        >
          ← Back to Tablecraft
        </Link>
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="label-caps text-[color:var(--accent)] mb-1">
            Tablecraft
          </p>
          <h1 className="font-display text-2xl text-[var(--ink)]">Operator Console</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Sign in with your staff account
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
