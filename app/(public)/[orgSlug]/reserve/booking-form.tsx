"use client";

import { useState } from "react";
import { useTableRealtime } from "@/lib/realtime";

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
  const [datetime, setDatetime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedDetails, setConfirmedDetails] = useState<{
    tableLabel?: string;
    capacity?: number;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const bookingDate = new Date(datetime);
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
        <h2 className="text-xl font-semibold mb-2">Booking Confirmed!</h2>
        <p className="text-gray-600">
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
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white"
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
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white"
        />
      </div>

      {/* Datetime */}
      <div>
        <label htmlFor="datetime" className="block text-sm font-medium mb-1.5">
          Date & time
        </label>
        <input
          id="datetime"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          required
          className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white"
        />
        <p className="text-xs text-gray-400 mt-1">
          Reservations are booked for a 2-hour duration.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow transition-transform active:scale-[0.99]"
        style={{ backgroundColor: accent }}
      >
        {submitting ? "Reserving table…" : "Confirm booking"}
      </button>
    </form>
  );
}
