/**
 * Dashboard loading state — shown after sign-in while the dashboard lists
 * the owner's restaurants. Matches the dashboard: white field, black ink, orange accent.
 */
export default function DashboardLoading() {
  return (
    <div
      className="min-h-screen bg-white text-neutral-950 flex flex-col items-center justify-center px-6"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="flex flex-col items-center border-2 border-black px-14 py-10">
        <p className="font-display text-[22px] tracking-tight">Tablecraft</p>
        <div
          className="mt-4 h-8 w-8 rounded-full border-2 border-[#d45200] border-t-transparent animate-spin"
          aria-hidden="true"
        />
        <p className="mt-4 text-[15px] text-neutral-500">Loading your dashboard…</p>
      </div>
      {/* Subtle content skeleton so layout doesn't jump on arrival */}
      <div className="mt-8 w-full max-w-2xl space-y-3" aria-hidden="true">
        <div className="h-16 w-full rounded-2xl bg-neutral-100 animate-pulse" />
        <div className="h-16 w-full rounded-2xl bg-neutral-100 animate-pulse" />
      </div>
    </div>
  );
}
