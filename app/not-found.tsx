import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
      <div className="w-full max-w-md text-center space-y-4">
        <p className="label-caps text-[var(--accent)]">404</p>
        <h1 className="font-display text-2xl">Page not found</h1>
        <p className="text-sm text-[var(--ink-soft)]">
          The page you are looking for does not exist or was moved.
        </p>
        <div className="flex gap-2 justify-center">
          <Link href="/" className="btn btn-accent text-sm">
            Back home
          </Link>
          <Link href="/restaurants" className="btn btn-outline text-sm">
            Browse restaurants
          </Link>
        </div>
      </div>
    </div>
  );
}
