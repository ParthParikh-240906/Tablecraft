import { createClient } from "@/lib/supabase/server";

export default async function BookingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS scopes this to the staff member's own org automatically.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, customer_name, party_size, datetime, status, tables(label)")
    .order("datetime", { ascending: true });

  const upcoming = (bookings ?? []).filter(
    (b) => new Date(b.datetime) >= new Date(),
  );
  const past = (bookings ?? []).filter(
    (b) => new Date(b.datetime) < new Date(),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Bookings</h1>

      {(!bookings || bookings.length === 0) && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
          No bookings yet.
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Upcoming ({upcoming.length})
          </h2>
          <BookingList bookings={upcoming} />
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Past ({past.length})
          </h2>
          <BookingList bookings={past} muted />
        </section>
      )}
    </div>
  );
}

function BookingList({
  bookings,
  muted = false,
}: {
  bookings: {
    id: string;
    customer_name: string;
    party_size: number;
    datetime: string;
    status: string;
    tables: { label: string } | { label: string }[] | null;
  }[];
  muted?: boolean;
}) {
  return (
    <ul className="bg-white rounded-2xl border divide-y">
      {bookings.map((b) => {
        const table = Array.isArray(b.tables) ? b.tables[0] : b.tables;
        const when = new Date(b.datetime).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <li
            key={b.id}
            className={`px-4 py-3 flex items-center justify-between gap-4 ${muted ? "opacity-60" : ""}`}
          >
            <div>
              <p className="font-medium">{b.customer_name}</p>
              <p className="text-sm text-gray-500">
                {when} · Table {table?.label ?? "?"} · {b.party_size}{" "}
                {b.party_size === 1 ? "person" : "people"}
              </p>
            </div>
            <span className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100">
              {b.status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}