import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import { BookingForm } from "./booking-form";

export default async function ReservePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  const accent = org.theme_color ?? "#f97316";

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      {/* Top Back Navigation Button */}
      <div className="mb-6">
        <Link
          href={`/${org.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back to {org.name}</span>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Book a Table</h1>
      <p className="text-gray-600 mb-8">
        Reserve your spot at {org.name}. Choose your party size, tell us when, and
        we will automatically prepare the optimal table for you (2-hour reservation).
      </p>

      <BookingForm orgId={org.id} orgSlug={org.slug} accent={accent} />

      {/* Bottom Back Button */}
      <div className="mt-8 pt-6 border-t border-[var(--rule)] text-center">
        <Link
          href={`/${org.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: accent }}
        >
          <span aria-hidden="true">&larr;</span>
          <span>Return to {org.name} overview</span>
        </Link>
      </div>
    </div>
  );
}
