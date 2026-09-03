"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Booking {
  id: string;
  customer_name: string;
  party_size: number;
  datetime: string;
  status: string;
  table_id?: string;
  tables: { id?: string; label: string } | { id?: string; label: string }[] | null;
}

interface TableOption {
  id: string;
  label: string;
  capacity: number;
  status?: string;
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

  const supabase = createClient();

  /**
   * Find best combination of open tables for partySize.
   * Always picks minimum total capacity (least waste).
   * Single table only chosen when its waste is strictly less than any combo.
   * Returns array of table IDs (may be length 1 for single-table fit).
   */
  function pickBestTables(size: number): string[] {
    if (openTables.length === 0) return [];

    const info = openTables.map((t) => ({ id: t.id, capacity: t.capacity, label: t.label }));

    // Tables big enough on their own — pick best single fit
    const largeEnough = info.filter((t) => t.capacity >= size);
    let bestSingleId: string | null = null;
    let bestSingleCapacity = Infinity;
    for (const t of largeEnough) {
      if (t.capacity < bestSingleCapacity) {
        bestSingleCapacity = t.capacity;
        bestSingleId = t.id;
      }
    }

    // Check every subset of small tables (2^N — restaurants have <20 tables)
    const small = info.filter((t) => t.capacity < size);
    let bestComboIds: string[] = [];
    let bestComboCapacity = Infinity;
    for (let mask = 1; mask < (1 << small.length); mask++) {
      let total = 0;
      const ids: string[] = [];
      for (let i = 0; i < small.length; i++) {
        if (mask & (1 << i)) {
          total += small[i].capacity;
          ids.push(small[i].id);
        }
      }
      if (total >= size && total < bestComboCapacity) {
        bestComboCapacity = total;
        bestComboIds = ids;
      }
    }

    // Combo wins unless single table is strictly better (less waste)
    if (bestSingleId && (!bestComboIds.length || bestSingleCapacity < bestComboCapacity)) {
      return [bestSingleId];
    }
    return bestComboIds;
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
    const isoDatetime = bookingDate.toISOString();

    // Determine target table IDs (explicit selection or automatic best-fit combo)
    const chosenTableIds: string[] = tableId ? [tableId] : pickBestTables(size);

    const primaryTableId = chosenTableIds[0] ?? null;

    const { data, error: insertError } = await supabase
      .from("bookings")
      .insert({
        org_id: orgId,
        customer_name: customerName.trim(),
        party_size: size,
        datetime: isoDatetime,
        table_id: primaryTableId,
        status: "confirmed",
      })
      .select("id, customer_name, party_size, datetime, status, table_id, tables(id, label)")
      .single();

    if (insertError) {
      setError(insertError.message);
      setAdding(false);
      return;
    }

    // Mark ALL tables in the combination as reserved and insert junction rows
    if (chosenTableIds.length > 0) {
      await supabase
        .from("tables")
        .update({ status: "reserved" })
        .in("id", chosenTableIds);
      // Insert non-primary tables into booking_tables junction (trigger handles primary)
      if (chosenTableIds.length > 1 && data?.id) {
        await supabase
          .from("booking_tables")
          .insert(chosenTableIds.slice(1).map((tid) => ({
            org_id: orgId,
            booking_id: data.id,
            table_id: tid,
            is_primary: false,
          })));
      }
    }

    if (data) {
      setUpcoming((prev) => [data as unknown as Booking, ...prev]);
    }

    setCustomerName("");
    setPartySize("2");
    setDatetime("");
    setTableId("");
    setShowAddForm(false);
    setAdding(false);
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
      if (newStatus === "confirmed" && booking.table_id) {
        const { error: tableError } = await supabase
          .from("tables")
          .update({ status: "reserved" })
          .eq("id", booking.table_id);
        if (tableError) {
          console.error("Failed to mark table reserved:", tableError);
        }
      } else if (newStatus === "cancelled" && booking.table_id) {
        const { error: tableError } = await supabase
          .from("tables")
          .update({ status: "open" })
          .eq("id", booking.table_id);
        if (tableError) {
          console.error("Failed to release table:", tableError);
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
          const table = Array.isArray(b.tables) ? b.tables[0] : b.tables;
          const when = new Date(b.datetime).toLocaleString('en-US', {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });

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
                  {when} · Table {table?.label ?? "Unassigned"} · {b.party_size}{" "}
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

          <div className="flex gap-2">
            <button type="submit" disabled={adding} className="btn btn-accent text-xs">
              {adding ? "Saving…" : "Save booking"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
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