import Link from "next/link";

export default function OrgNotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
      <p className="text-xs uppercase tracking-widest opacity-60">404</p>
      <h1 className="font-display text-2xl">Restaurant not found</h1>
      <p className="text-sm opacity-80">
        This restaurant URL does not exist. Check the spelling or browse other restaurants.
      </p>
      <div className="flex gap-2 justify-center">
        <Link
          href="/restaurants"
          className="py-2.5 px-5 rounded-full text-white font-medium"
          style={{ backgroundColor: "#f97316" }}
        >
          Browse restaurants
        </Link>
        <Link href="/" className="py-2.5 px-5 rounded-full border font-medium">
          Back home
        </Link>
      </div>
    </div>
  );
}
