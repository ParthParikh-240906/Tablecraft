export default function Loading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4" aria-busy="true">
      <div className="w-full max-w-2xl space-y-3">
        <div className="h-8 w-1/2 rounded bg-current opacity-10 animate-pulse" />
        <div className="h-4 w-full rounded bg-current opacity-10 animate-pulse" />
        <div className="h-48 w-full rounded bg-current opacity-10 animate-pulse" />
      </div>
    </div>
  );
}
