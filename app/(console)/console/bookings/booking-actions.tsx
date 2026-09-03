"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface BookingTable {
  id: string;
  label: string;
}

interface Booking {
  id: string;
  customer_name: string;
  party_size: number;
  datetime: string;
  status: string;
  table_id?: string;
  tables: BookingTable[] | null;
}

interface TableOption {
  id: string;
  label: string;
  capacity: number;
  status?: string;
  table_type?: "movable" | "non-movable";
}

export function BookingActionsList({
  orgId,
  initialBookings,
  pastBookings = [],
  tables = [],
}: {
  orgId: string;
  initialBookings: Booking[];
  pastBookings?: Booking[];
  tables?: TableOption[];
}) {
  const [upcoming, setUpcoming] = useState<Booking[]>(initialBookings);
  const [past, setPast] = useState<Booking[]>(pastBookings);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Search filter states
  const [searchName, setSearchName] = useState("");
  const [searchDate, setSearchDate] = useState("");

  // Available tables (only open tables)
  const openTables = tables.filter((t) => t.status === "open");

  // New Booking State
  const [showAddForm, setShowAddForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [datetime, setDatetime] = useState("");
  const [tableId, setTableId] = useState(""); // "" means Auto
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCombo, setPendingCombo] = useState<{
    message: string;
    tables: { id: string; label: string; capacity: number }[];
  } | null>(null);

  const supabase = createClient();

  /**
   * Effective capacity for booking logic:
   * - non-movable: uses actual capacity
   * - movable: fixed at 4 alone, 6 when paired (two square tables pushed together)
   */
  function effectiveCapacity(t: TableOption): number {
    if (t.table_type === "movable") return 4;
    return t.capacity;
  }

  /**
   * Find best open tables for partySize.
   *
   * Rules:
   * - non-movable: single table only (no combining), use actual capacity
   * - movable: single=4 seats, pair=6 seats (max 2 combined)
   * - Compare best non-movable single vs best movable option, least empty seats wins
   * - Tie-break: prefer non-movable
   */
  function pickBestTables(size: number): string[] {
    const movable = openTables.filter((t) => t.table_type === "movable");
    const nonMovable = openTables.filter((t) => t.table_type !== "movable");

    // Best single non-movable table (no combining)
    let bestNM: { ids: string[]; waste: number } | null = null;
    for (const t of nonMovable) {
      if (t.capacity >= size) {
        const waste = t.capacity - size;
        if (!bestNM || waste < bestNM.waste) {
          bestNM = { ids: [t.id], waste };
        }
      }
    }

    // Best movable option: n tables = 2n+2 seats (1→4, 2→6, 3→8, ...)
    // First n that fits is optimal — smallest n = least waste.
    let bestMv: { ids: string[]; waste: number } | null = null;
    for (let n = 1; n <= movable.length; n++) {
      const seats = 2 * n + 2;
      if (seats >= size) {
        bestMv = { ids: movable.slice(0, n).map((t) => t.id), waste: seats - size };
        break;
      }
    }

    // Compare: non-movable wins ties
    if (bestNM && (!bestMv || bestNM.waste <= bestMv.waste)) return bestNM.ids;
    if (bestMv) return bestMv.ids;
    return [];
  }

  async function handleAddBooking(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const size = parseInt(partySize, 10);
    if (!customerName.trim() || !datetime || isNaN(size) || size <= 0) {
      setError("Please fill out all fields with valid values.");
      return;
    }

    const bookingDate = new Date(datetime);
    if (bookingDate.getTime() < Date.now() - 60000) {
      setError("Booking date and time cannot be in the past.");
      return;
    }

    setAdding(true);

    // Determine target table IDs (explicit selection or automatic best-fit)
    const chosenTableIds: string[] = tableId ? [tableId] : pickBestTables(size);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          customerName: customerName.trim(),
          partySize: size,
          datetime: bookingDate.toISOString(),
          ...(chosenTableIds.length > 0 ? { tableIds: chosenTableIds } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Could not create booking");
        setAdding(false);
        return;
      }

      // Multi-table fallback: API proposes a combo, needs staff approval
      if (data.needsConfirmation) {
        setPendingCombo({
          message: data.message,
          tables: data.tables,
        });
        setAdding(false);
        return;
      }

      const booking = data.booking;
      const allTables: BookingTable[] = (data.tables ?? [{ id: booking?.table_id, label: "" }])
        .map((t: any) => ({ id: t.id, label: t.label }))
        .filter((t: BookingTable) => t.id);

      if (booking) {
        setUpcoming((prev) => [
          { ...booking, tables: allTables } as unknown as Booking,
          ...prev,
        ]);
      }

      setCustomerName("");
      setPartySize("2");
      setDatetime("");
      setTableId("");
      setShowAddForm(false);
      setPendingCombo(null);
    } catch {
      setError("Network error — please try again");
    } finally {
      setAdding(false);
    }
  }

  async function handleConfirmCombo() {
    if (!pendingCombo) return;
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          customerName: customerName.trim(),
          partySize: parseInt(partySize, 10),
          datetime,
          tableIds: pendingCombo.tables.map((t) => t.id),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Could not create booking");
        setPendingCombo(null);
      } else {
        const booking = data.booking;
        const allTables: BookingTable[] = (data.tables ?? [{ id: booking?.table_id, label: "" }])
          .map((t: any) => ({ id: t.id, label: t.label }))
          .filter((t: BookingTable) => t.id);
        if (booking) {
          setUpcoming((prev) => [
            { ...booking, tables: allTables } as unknown as Booking,
            ...prev,
          ]);
        }
        setCustomerName("");
        setPartySize("2");
        setDatetime("");
        setTableId("");
        setShowAddForm(false);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setAdding(false);
      setPendingCombo(null);
    }
  }

  async function handleRejectCombo() {
    setPendingCombo(null);
  }

  async function getAllTableIds(bookingId: string): Promise<string[]> {
    const { data } = await supabase
      .from("booking_tables")
      .select("table_id")
      .eq("booking_id", bookingId);
    const junctionIds = data?.map((r) => r.table_id) ?? [];
    // Fallback for bookings created before junction table existed (no junction rows):
    // use the stored table_id on the booking itself.
    if (junctionIds.length === 0) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("table_id")
        .eq("id", bookingId)
        .single();
      if (booking?.table_id) return [booking.table_id];
    }
    return junctionIds;
  }

  async function updateStatus(booking: Booking, newStatus: string) {
    setUpdatingId(booking.id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", booking.id);

    if (error) {
      console.error("Failed to update booking status:", error);
    } else {
      if (newStatus === "confirmed") {
        // Release all junction tables back to "reserved" for multi-table bookings
        const tableIds = await getAllTableIds(booking.id);
        if (tableIds.length > 0) {
          const { error: tableError } = await supabase
            .from("tables")
            .update({ status: "reserved" })
            .in("id", tableIds);
          if (tableError) {
            console.error("Failed to mark tables reserved:", tableError);
          }
        }
      } else if (newStatus === "cancelled") {
        // Free ALL tables associated with this booking (primary + junction)
        const tableIds = await getAllTableIds(booking.id);
        if (tableIds.length > 0) {
          const { error: tableError } = await supabase
            .from("tables")
            .update({ status: "open" })
            .in("id", tableIds);
          if (tableError) {
            console.error("Failed to release tables:", tableError);
          }
        }
      }

      setUpcoming((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b))
      );
      setPast((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b))
      );
    }
    setUpdatingId(null);
  }

  async function handleDeleteBooking(bookingId: string) {
    if (!confirm("Are you sure you want to delete this cancelled booking?")) {
      return;
    }

    setUpdatingId(bookingId);
    // Free ALL tables associated with this booking (primary + junction) before deleting
    const tableIds = await getAllTableIds(bookingId);
    if (tableIds.length > 0) {
      const { error: tableError } = await supabase
        .from("tables")
        .update({ status: "open" })
        .in("id", tableIds);
      if (tableError) {
        console.error("Failed to release tables on delete:", tableError);
      }
    }
    // Delete junction rows first (so cascade on bookings doesn't race)
    await supabase.from("booking_tables").delete().eq("booking_id", bookingId);
    // Delete the booking itself
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (error) {
      console.error("Failed to delete booking:", error);
    } else {
      setUpcoming((prev) => prev.filter((b) => b.id !== bookingId));
      setPast((prev) => prev.filter((b) => b.id !== bookingId));
    }
    setUpdatingId(null);
  }

  const renderBookingList = (items: Booking[], muted = false) => {
    if (items.length === 0) {
      return (
        <div className="ticket p-8 text-center text-sm text-[var(--ink-faint)]">
          No bookings to display.
        </div>
      );
    }

    return (
      <ul className="rounded-sm border border-[var(--rule)] divide-y divide-[var(--rule)] bg-[var(--paper-raised)]">
        {items.map((b) => {
          const tableLabels = (b.tables ?? []).map((t) => t.label).filter(Boolean);
          const tableDisplay = tableLabels.length > 0
            ? tableLabels.join("+")
            : "Unassigned";
          // Use a locale-independent format to avoid SSR/client hydration mismatch.
          // toLocaleString produces different output between Node.js and browser.
          const d = new Date(b.datetime);
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          const h = d.getHours();
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          const when = `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} at ${h12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;

          const isConfirmed = b.status === "confirmed";
          const isCancelled = b.status === "cancelled";

          return (
            <li
              key={b.id}
              className={`px-4 py-3 flex flex-wrap items-center justify-between gap-4 ${
                muted || isCancelled ? "opacity-60" : ""
              }`}
            >
              <div>
                <p className="font-medium text-[var(--ink)]">{b.customer_name}</p>
                <p className="text-sm text-[var(--ink-faint)]">
                  {when} · Tables {tableDisplay} · {b.party_size}{" "}
                  {b.party_size === 1 ? "person" : "people"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded-sm border ${
                    isConfirmed
                      ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                      : isCancelled
                      ? "bg-red-950/40 text-red-400 border-red-800"
                      : "bg-amber-950/40 text-amber-300 border-amber-800"
                  }`}
                >
                  {b.status}
                </span>

                {updatingId === b.id ? (
                  <span className="text-xs text-[var(--ink-faint)]">Updating...</span>
                ) : (
                  <div className="flex items-center gap-1">
                    {!isConfirmed && (
                      <button
                        type="button"
                        onClick={() => updateStatus(b, "confirmed")}
                        className="text-xs px-2 py-1 rounded-sm border border-emerald-800 hover:bg-emerald-950/40 text-emerald-300"
                        title="Confirm booking"
                      >
                        Confirm
                      </button>
                    )}
                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => updateStatus(b, "cancelled")}
                        className="text-xs px-2 py-1 rounded-sm border border-red-800 hover:bg-red-950/40 text-red-400"
                        title="Cancel booking"
                      >
                        Cancel
                      </button>
                    )}
                    {isCancelled && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBooking(b.id)}
                        className="text-xs px-2 py-1 rounded-sm border border-red-900/60 bg-red-950/20 hover:bg-red-900/40 text-red-400 font-medium"
                        title="Delete cancelled booking"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-xl">Bookings</h1>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5">
            Manage table reservations and incoming bookings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="btn btn-accent text-xs"
        >
          {showAddForm ? "Cancel" : "+ Add booking"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddBooking} className="ticket p-5 mb-6 space-y-4">
          <h2 className="font-medium text-sm text-[var(--ink)]">Add Walk-in / Manual Booking</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="bCustName" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                Guest Name
              </label>
              <input
                id="bCustName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                className="input"
              />
            </div>
            <div>
              <label htmlFor="bPartySize" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                Party Size
              </label>
              <input
                id="bPartySize"
                type="number"
                min="1"
                max="50"
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label htmlFor="bDatetime" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                Date & Time
              </label>
              <input
                id="bDatetime"
                type="datetime-local"
                value={datetime}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setDatetime(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label htmlFor="bTable" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
                Assign Available Table
              </label>
              <select
                id="bTable"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="input"
              >
                <option value="">Auto (Best fit — least empty seats)</option>
                {openTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} (Seats {t.capacity})
                  </option>
                ))}
              </select>
              {openTables.length === 0 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  No tables are currently open.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm">
              {error}
            </p>
          )}

          {pendingCombo && (
            <div className="rounded-sm border border-amber-700 bg-amber-950/30 p-3">
              <p className="text-xs text-amber-300 mb-3">{pendingCombo.message}</p>
              <ul className="text-xs text-[var(--ink)] mb-3 space-y-0.5">
                {pendingCombo.tables.map((t) => (
                  <li key={t.id}>• {t.label} — {t.capacity} seats</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmCombo}
                  disabled={adding}
                  className="btn btn-accent text-xs"
                >
                  {adding ? "Saving…" : "Accept"}
                </button>
                <button
                  type="button"
                  onClick={handleRejectCombo}
                  className="btn btn-outline text-xs"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={adding} className="btn btn-accent text-xs">
              {adding ? "Saving…" : "Save booking"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setPendingCombo(null); }}
              className="btn btn-outline text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Bar */}
      <div className="ticket p-4 mb-6 bg-[var(--paper-raised)] border border-[var(--rule)]">
        <p className="text-xs uppercase tracking-wider font-semibold text-[var(--ink-soft)] mb-2">
          Search Bookings
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="searchNameInput" className="block text-[11px] text-[var(--ink-faint)] mb-1">
              Filter by Guest Name
            </label>
            <input
              id="searchNameInput"
              type="text"
              placeholder="e.g. John, Sarah..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="input text-xs"
            />
          </div>
          <div>
            <label htmlFor="searchDateInput" className="block text-[11px] text-[var(--ink-faint)] mb-1">
              Filter by Date / Time
            </label>
            <input
              id="searchDateInput"
              type="text"
              placeholder="e.g. 2026-08-29 or 7:30 PM..."
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="input text-xs"
            />
          </div>
        </div>
        {(searchName || searchDate) && (
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--rule)]">
            <span className="text-xs text-[var(--accent)]">
              Filtering by: {searchName ? `"${searchName}" ` : ""}{searchDate ? `[${searchDate}]` : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchName("");
                setSearchDate("");
              }}
              className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink)] underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {(() => {
        // Apply search filters
        const filterFn = (b: Booking) => {
          const nameMatch = !searchName.trim() || b.customer_name.toLowerCase().includes(searchName.trim().toLowerCase());
          
          let dateMatch = true;
          if (searchDate.trim()) {
            const term = searchDate.trim().toLowerCase();
            const rawIso = b.datetime.toLowerCase();
            const formatted = new Date(b.datetime).toLocaleString('en-US').toLowerCase();
            dateMatch = rawIso.includes(term) || formatted.includes(term);
          }

          return nameMatch && dateMatch;
        };

        const filteredUpcoming = upcoming.filter(filterFn);
        const filteredPast = past.filter(filterFn);

        return (
          <>
            {filteredUpcoming.length > 0 && (
              <section className="mb-8">
                <h2 className="label-caps text-[color:var(--accent)] mb-3">
                  Upcoming ({filteredUpcoming.length})
                </h2>
                {renderBookingList(filteredUpcoming)}
              </section>
            )}

            {filteredPast.length > 0 && (
              <section>
                <h2 className="label-caps text-[var(--ink-faint)] mb-3">
                  Past ({filteredPast.length})
                </h2>
                {renderBookingList(filteredPast, true)}
              </section>
            )}

            {filteredUpcoming.length === 0 && filteredPast.length === 0 && (
              <div className="ticket p-10 text-center text-[var(--ink-faint)]">
                {searchName || searchDate
                  ? "No bookings matched your search query."
                  : "No bookings found."}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}