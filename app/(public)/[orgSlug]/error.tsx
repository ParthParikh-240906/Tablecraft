"use client";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNotFound =
    error?.message === "ORG_NOT_FOUND" || error?.message === "ORG_FETCH_FAILED";
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="font-display text-2xl">Could not load this restaurant</h1>
      <p className="text-sm opacity-80" role="alert">
        {isNotFound
          ? "This restaurant could not be found."
          : (error?.message || "A network or server error occurred. Please try again.")}
      </p>
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="py-2.5 px-5 rounded-full text-white font-medium"
          style={{ backgroundColor: "#f97316" }}
        >
          Try again
        </button>
        <a href="/restaurants" className="py-2.5 px-5 rounded-full border font-medium">
          Browse restaurants
        </a>
      </div>
    </div>
  );
}
