"use client";

import { useState } from "react";
import { useTableRealtime } from "@/lib/realtime";

export function BookingForm({ orgId, accent }: { orgId: string; accent: string }) {
  const { tables, connected } = useTableRealtime(orgId);
  const openTables = tables.filter((t) => t.status === "open");

  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [size, setSize] = useState(2);
  const [datetime, setDatetime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug: window.location.pathname.split("/")[1],
          tableId,
          customerName,
          partySize: size,
          datetime: new Date(datetime).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create booking");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border p-8 text-center">
        <div
          className="h-12 w-12 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl"
          style={{ backgroundColor: accent }}
        >
          ✓
        </div>
        <h2 className="text-xl font-semibold mb-2">Booking confirmed!</h2>
        <p className="text-gray-600">
          Your table is reserved. We look forward to seeing you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Table picker — live availability */}
      <div>
        <label htmlFor="table" className="block text-sm font-medium mb-1.5">
          Table
        </label>
        {openTables.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">
            {connected ? "No open tables right now — check back soon." : "Loading tables…"}
          </p>
        ) : (
          <select
            id="table"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            required
            className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white"
          >
            <option value="" disabled>
              Choose a table…
            </option>
            {openTables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — seats {t.capacity}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {connected ? "● Live availability" : "○ Connecting…"}
        </p>
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
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      {/* Size */}
      <div>
        <label htmlFor="size" className="block text-sm font-medium mb-1.5">
          Size
        </label>
        <input
          id="size"
          type="number"
          min={1}
          max={20}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          required
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
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
          required
          className="w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !tableId || openTables.length === 0}
        className="w-full py-3 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: accent }}
      >
        {submitting ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}