/**
 * Console loading state — shown while the console layout resolves the
 * staff org (?org= → header → cookie → default) and the dashboard page
 * fetches stats/bookings/orders. Branded so the ~1s wait looks intentional
 * instead of broken grey boxes.
 */
export default function ConsoleLoading() {
  return (
    <div
      className="min-h-screen flex"
      aria-busy="true"
      aria-label="Loading console"
      style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Sidebar skeleton (desktop) */}
      <div
        className="hidden md:flex w-60 shrink-0 flex-col gap-3 p-4 border-r"
        aria-hidden="true"
        style={{ borderColor: "var(--rule)" }}
      >
        <div className="h-8 w-32 rounded bg-current opacity-10 animate-pulse" />
        <div className="mt-4 space-y-2">
          {["Dashboard", "Tables", "Menu", "Orders", "Reservations"].map((l) => (
            <div key={l} className="h-9 w-full rounded bg-current opacity-10 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <p className="font-display text-lg tracking-tight" style={{ color: "var(--ink)" }}>
          Tablecraft
        </p>
        <div
          className="mt-4 h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          aria-hidden="true"
        />
        <p className="mt-4 text-sm" style={{ color: "var(--ink-soft)" }}>
          Loading your restaurant…
        </p>
      </div>
    </div>
  );
}
