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

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Book a Table</h1>
      <p className="text-gray-600 mb-8">
        Reserve your spot at {org.name}. Pick a table, tell us when, and
        we'll have it ready.
      </p>
      <BookingForm orgId={org.id} accent={org.theme_color ?? "#f97316"} />
    </div>
  );
}