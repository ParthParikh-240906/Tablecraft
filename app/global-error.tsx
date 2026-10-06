"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm opacity-70" role="alert">
            {error?.message || "We could not load this page. Check your connection and try again."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 text-sm rounded bg-[#f97316] text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
