/**
 * Dashboard loading state — shown after sign-in while the dashboard lists
 * the owner's restaurants. Branded to avoid the generic grey-box flash.
 */
export default function DashboardLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      aria-busy="true"
      aria-label="Loading dashboard"
      style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
    >
      <p className="font-display text-lg tracking-tight">Tablecraft</p>
      <div
        className="mt-4 h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        aria-hidden="true"
      />
      <p className="mt-4 text-sm" style={{ color: "var(--ink-soft)" }}>
        Loading your dashboard…
      </p>
      {/* Subtle content skeleton so layout doesn't jump on arrival */}
      <div className="mt-8 w-full max-w-2xl space-y-2" aria-hidden="true">
        <div className="h-12 w-full rounded bg-current opacity-10 animate-pulse" />
        <div className="h-12 w-full rounded bg-current opacity-10 animate-pulse" />
      </div>
    </div>
  );
}
