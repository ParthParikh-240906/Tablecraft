"use client";

import { useState } from "react";
import { useTableRealtime } from "@/lib/realtime";

interface ComboTableInfo {
  id: string;
  label: string;
  capacity: number;
}

export function BookingForm({
  orgId,
  orgSlug,
  accent,
}: {
  orgId: string;
  orgSlug: string;
  accent: string;
}) {
  const { tables, connected } = useTableRealtime(orgId);

  const [customerName, setCustomerName] = useState("");
  const [size, setSize] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedDetails, setConfirmedDetails] = useState<{
    tableLabel?: string;
    capacity?: number;
  } | null>(null);

  // Multi-table confirmation state (public storefront fallback)
  const [pendingCombo, setPendingCombo] = useState<{
    message: string;
    tables: ComboTableInfo[];
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const parts = date.split("-");
    if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
      setError("Please enter the date in DD-MM-YYYY format.");
      setSubmitting(false);
      return;
    }
    const [day, month, year] = parts;
    const isoDate = `${year}-${month}-${day}T${time}:00`;
    const bookingDate = new Date(isoDate);
    if (isNaN(bookingDate.getTime())) {
      setError("Invalid date/time. Please check your input.");
      setSubmitting(false);
      return;
    }
    if (bookingDate.getTime() < Date.now() - 60000) {
      setError("Booking date & time cannot be in the past.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          customerName,
          partySize: size,
          datetime: bookingDate.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create booking");
      } else if (data.needsConfirmation) {
        // API found a non-movable combo but needs guest approval
        setPendingCombo({
          message: data.message,
          tables: data.tables,
        });
      } else {
        setConfirmedDetails({
          tableLabel: data.table?.label,
          capacity: data.table?.capacity,
        });
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmCombo() {
    if (!pendingCombo) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          customerName,
          partySize: size,
          tableIds: pendingCombo.tables.map((t) => t.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create booking");
        setPendingCombo(null);
      } else {
        setConfirmedDetails({
          tableLabel: data.table?.label,
          capacity: data.table?.capacity,
        });
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedDetails) {
    return (
      <div className="rounded-2xl border border-[var(--rule)] bg-[var(--paper-raised)] p-8 text-center shadow-sm">
        <div
          className="h-12 w-12 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl"
          style={{ backgroundColor: accent }}
        >
          ✓
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: "black" }}>Booking Confirmed!</h2>
        <p className="text-gray-900 font-medium">
          Your table has been reserved. We look forward to seeing you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Auto table assignment info badge */}
      <div className="rounded-xl border border-dashed border-[var(--rule)] bg-[var(--paper-raised)] p-3.5 text-xs text-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <span>Table will be automatically assigned for optimal seating</span>
        </div>
        <span className="text-[11px] text-gray-400 font-mono">
          {connected ? "● Live system" : "○ Connecting…"}
        </span>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1.5">
          Your name
        </label>
        <input
          id="name"
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
          minLength={2}
          placeholder="Jane Doe"
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-black"
        />
      </div>

      {/* Size */}
      <div>
        <label htmlFor="size" className="block text-sm font-medium mb-1.5">
          Party Size (Guests)
        </label>
        <input
          id="size"
          type="number"
          min={1}
          max={20}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          required
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-black"
        />
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium mb-1.5">
          Date
        </label>
        <input
          id="date"
          type="text"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="DD-MM-YYYY"
          required
          pattern="\d{2}-\d{2}-\d{4}"
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-black font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">Format: DD-MM-YYYY (e.g. 15-07-2025)</p>
      </div>

      {/* Time */}
      <div>
        <label htmlFor="time" className="block text-sm font-medium mb-1.5">
          Time
        </label>
        <input
          id="time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white text-black"
        />
        <p className="text-xs text-gray-400 mt-1">
          Reservations are booked for a 2-hour duration.
        </p>
      </div>

      {/* Multi-table confirmation prompt */}
      {pendingCombo && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800 mb-3">{pendingCombo.message}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmCombo}
              className="flex-1 py-2.5 rounded-full text-white font-medium shadow transition-transform active:scale-[0.99]"
              style={{ backgroundColor: accent }}
            >
              Yes, that works
            </button>
            <button
              type="button"
              onClick={() => setPendingCombo(null)}
              className="flex-1 py-2.5 rounded-full text-white font-medium shadow transition-transform active:scale-[0.99] bg-gray-500"
            >
              No, thanks
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !!pendingCombo}
        className="w-full py-3 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow transition-transform active:scale-[0.99]"
        style={{ backgroundColor: accent }}
      >
        {submitting ? "Reserving table…" : "Confirm booking"}
      </button>
    </form>
  );
}
