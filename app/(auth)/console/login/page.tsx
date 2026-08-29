"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/console/tables";

  const [email, setEmail] = useState("");
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
    <form onSubmit={handleSubmit} className="space-y-5 border border-[var(--rule)] p-6 rounded-sm">
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
          className="input"
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
          className="input"
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
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function ConsoleLoginPage() {
  return (
    <div className="surface-dark min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="label-caps text-[color:var(--accent)] mb-1">
            Tablecraft
          </p>
          <h1 className="font-display text-2xl">Operator Console</h1>
          <p className="text-sm text-[var(--ink-faint)] mt-1">
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