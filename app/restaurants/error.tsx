"use client";

export default function RestaurantsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
      <div className="ticket p-8 text-center max-w-md w-full space-y-4">
        <h1 className="font-display text-xl">Could not load restaurants</h1>
        <p className="text-sm text-[var(--ink-soft)]" role="alert">
          {error?.message || "A network error occurred. Try again."}
        </p>
        <div className="flex gap-2 justify-center">
          <button type="button" onClick={() => reset()} className="btn btn-accent text-sm">
            Try again
          </button>
          <a href="/" className="btn btn-outline text-sm">
            Back home
          </a>
        </div>
      </div>
    </div>
  );
}
