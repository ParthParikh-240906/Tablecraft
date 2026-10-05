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
  inputBg,
  inputText,
  inputBorder,
  labelColor = "#000000",
}: {
  orgId: string;
  orgSlug: string;
  accent: string;
  inputBg: string;
  inputText: string;
  inputBorder: string;
  labelColor?: string;
}) {
  const { tables, connected, connectError } = useTableRealtime(orgId);
  void tables;
  void connected;

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
    datetime: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submitting) return;
    setSubmitting(true);

    const trimmedName = customerName.trim();
    if (trimmedName.length < 2) {
      setError("Please enter your name (at least 2 characters).");
      setSubmitting(false);
      return;
    }
    if (!Number.isInteger(size) || size < 1 || size > 20) {
      setError("Party size must be between 1 and 20.");
      setSubmitting(false);
      return;
    }
    if (!time) {
      setError("Please pick a time for your reservation.");
      setSubmitting(false);
      return;
    }

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
          customerName: trimmedName,
          partySize: size,
          datetime: bookingDate.toISOString(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create booking");
      } else if (data?.needsConfirmation) {
        // API found a non-movable combo but needs guest approval
        setPendingCombo({
          message: data.message,
          tables: data.tables,
          datetime: bookingDate.toISOString(),
        });
      } else {
        setPendingCombo(null);
        setConfirmedDetails({
          tableLabel: data?.table?.label,
          capacity: data?.table?.capacity,
        });
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmCombo() {
    if (!pendingCombo || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          customerName: customerName.trim(),
          partySize: size,
          datetime: pendingCombo.datetime,
          tableIds: pendingCombo.tables.map((t) => t.id),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Keep the combo offer so the guest can retry instead of starting over.
        setError(data?.error ?? "Could not create booking");
      } else {
        setPendingCombo(null);
        setConfirmedDetails({
          tableLabel: data?.table?.label,
          capacity: data?.table?.capacity,
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
          <h2 className="text-xl font-semibold mb-2" style={{ color: inputText }}>Booking Confirmed!</h2>
          <p className="font-medium" style={{ color: inputText }}>
            Your table has been reserved. We look forward to seeing you.
          </p>
        </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1.5" style={{ color: labelColor }}>
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
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
          style={{ backgroundColor: inputBg, color: inputText, borderColor: inputBorder }}
        />
      </div>

      {/* Size */}
      <div>
        <label htmlFor="size" className="block text-sm font-medium mb-1.5" style={{ color: labelColor }}>
          Party Size (Guests)
        </label>
        <input
          id="size"
          type="number"
          min={1}
          max={20}
          value={size}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (e.target.value === "") return;
            if (Number.isFinite(n)) setSize(Math.min(20, Math.max(1, Math.floor(n))));
          }}
          required
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
          style={{ backgroundColor: inputBg, color: inputText, borderColor: inputBorder }}
        />
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium mb-1.5" style={{ color: labelColor }}>
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
          className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono"
          style={{ backgroundColor: inputBg, color: inputText, borderColor: inputBorder }}
        />
        <p className="text-xs text-[var(--ink-faint)] mt-1">Format: DD-MM-YYYY (e.g. 15-07-2025)</p>
      </div>

      {/* Time */}
      <div>
        <label htmlFor="time" className="block text-sm font-medium mb-1.5" style={{ color: labelColor }}>
          Time
        </label>
        <input
          id="time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
          style={{ backgroundColor: inputBg, color: inputText, borderColor: inputBorder }}
        />
        <p className="text-xs text-[var(--ink-faint)] mt-1">
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
              disabled={submitting}
              className="flex-1 py-2.5 rounded-full text-white font-medium shadow transition-transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: accent }}
            >
              {submitting ? "Reserving…" : "Yes, that works"}
            </button>
            <button
              type="button"
              onClick={() => setPendingCombo(null)}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-full text-white font-medium shadow transition-transform active:scale-[0.99] bg-gray-500 disabled:opacity-50"
            >
              No, thanks
            </button>
          </div>
        </div>
      )}

      {connectError && (
        <p className="text-sm text-amber-800 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2" role="status">
          Live availability is temporarily unavailable — you can still book, but times may be approximate.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 rounded-lg bg-red-50 border border-red-200 px-3 py-2" role="alert">
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
