"use client";

import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SlotState = {
  name: string | null;
  party_size: number | null;
  date: string | null;
  time: string | null;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

type ComboDetails = {
  message: string;
  tables: Array<{ id: string; label: string; capacity: number }>;
};

type Status = "idle" | "collecting" | "confirming" | "waiting_for_combo" | "submitting" | "done" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function BookingChatbot({
  orgSlug,
  orgName,
  accent,
}: {
  orgSlug: string;
  orgName: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [slots, setSlots] = useState<SlotState>({ name: null, party_size: null, date: null, time: null });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<keyof SlotState | null>(null);
  const [editValue, setEditValue] = useState("");
  const [comboDetails, setComboDetails] = useState<ComboDetails | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  function reset() {
    setOpen(false);
    setStatus("idle");
    setSlots({ name: null, party_size: null, date: null, time: null });
    setMessages([]);
    setInput("");
    setError(null);
    setEditingField(null);
    setComboDetails(null);
  }

  function newSession() {
    reset();
  }

  // ---------------------------------------------------------------------------
  // Send message to LLM
  // ---------------------------------------------------------------------------
  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text) return;

    // If waiting for combo confirmation, any positive reply auto-books
    if (status === "waiting_for_combo" && comboDetails) {
      const lower = text.toLowerCase();
      if (/^(yes|yeah|yep|sure|ok|okay|go ahead|proceed|fine|sounds good)$/i.test(lower)) {
        await submitComboBooking(comboDetails);
        return;
      }
      // Negative reply — go back to confirming
      setMessages((prev) => [...prev, { role: "user", text }]);
      setStatus("confirming");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setError(null);
    setStatus("collecting");

    try {
      const res = await fetch("/api/chat/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, slots, history: messages }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "AI service error");
      }

      const newSlots: SlotState = data.slots ?? {};
      setSlots(newSlots);
      const assistantText = data.response ?? "Got it!";
      setMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);

      // Check if all fields collected
      if (data.complete) {
        setStatus("confirming");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStatus("error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Having trouble right now — you can also book directly using the form below.",
        },
      ]);
    }
  }

  async function submitComboBooking(combo: ComboDetails) {
    setStatus("submitting");
    const { name, party_size, date, time } = slots;
    const datetime = `${date}T${time}`;
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          customerName: name,
          partySize: party_size,
          datetime,
          tableIds: combo.tables.map((t) => t.id),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Booking failed");
      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Booking failed";
      setError(msg);
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Submit booking via existing API
  // ---------------------------------------------------------------------------
  async function submitBooking() {
    setStatus("submitting");
    setError(null);

    const { name, party_size, date, time } = slots;
    const datetime = `${date}T${time}`;

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          customerName: name,
          partySize: party_size,
          datetime,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Booking failed");
      }

      // Handle multi-table confirmation from existing API — ask user instead of auto-booking
      if (data.needsConfirmation) {
        const comboMsg = data.message ?? "We need to combine multiple tables for your party. Is that okay?";
        const comboTables: Array<{ id: string; label: string; capacity: number }> = data.tables ?? [];
        setComboDetails({ message: comboMsg, tables: comboTables });
        setStatus("waiting_for_combo");
        setMessages((prev) => [...prev, { role: "assistant", text: comboMsg }]);
        return;
      }

      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Booking failed";
      setError(msg);
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Edit a slot field
  // ---------------------------------------------------------------------------
  function startEdit(field: keyof SlotState) {
    setEditingField(field);
    const val = slots[field] ?? "";
    setEditValue(typeof val === "number" ? String(val) : String(val));
  }

  function saveEdit() {
    if (!editingField) return;
    const next = { ...slots, [editingField]: editValue };
    if (editingField === "party_size") {
      const n = parseInt(editValue, 10);
      next.party_size = !isNaN(n) && n >= 1 && n <= 20 ? n : null;
    } else if (editingField === "name") {
      next.name = editValue.trim() || null;
    } else if (editingField === "date" || editingField === "time") {
      next[editingField] = editValue.trim() || null;
    }
    setSlots(next);
    setEditingField(null);

    // If we had all fields and now edited one, go back to collecting
    if (status === "confirming") {
      setStatus("collecting");
    }
  }

  function cancelEdit() {
    setEditingField(null);
  }

  // ---------------------------------------------------------------------------
  // Render: empty state (before open)
  // ---------------------------------------------------------------------------
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: accent }}
        aria-label="Open booking assistant"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="6" r="3" />
          <line x1="12" y1="9" x2="12" y2="11" />
          <line x1="8" y1="14" x2="8" y2="17" />
          <line x1="16" y1="14" x2="16" y2="17" />
          <line x1="10" y1="15" x2="10" y2="16" />
          <line x1="14" y1="15" x2="14" y2="16" />
        </svg>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: filled slots indicator
  // ---------------------------------------------------------------------------
  const filledCount = [slots.name, slots.party_size, slots.date, slots.time].filter(Boolean).length;
  const fields: Array<{ key: keyof SlotState; label: string }> = [
    { key: "name", label: "Name" },
    { key: "party_size", label: "Party" },
    { key: "date", label: "Date" },
    { key: "time", label: "Time" },
  ];

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-20px)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border"
      style={{
        backgroundColor: "var(--paper-raised)",
        borderColor: "var(--rule)",
        maxHeight: "calc(100vh - 40px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--rule)", backgroundColor: `${accent}15` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🤖</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
              Book a table
            </p>
            <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {orgName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(status === "collecting" || status === "confirming") && (
            <button
              onClick={newSession}
              className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
              style={{ color: "var(--ink-soft)", backgroundColor: "var(--paper-overlay)" }}
              title="Start fresh"
            >
              New
            </button>
          )}
          <button
            onClick={reset}
            className="ml-1 h-7 w-7 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
            style={{ color: "var(--ink-soft)", backgroundColor: "var(--paper-overlay)" }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slots progress bar */}
      {status !== "done" && status !== "error" && (
        <div className="px-4 py-2 border-b flex items-center gap-1.5" style={{ borderColor: "var(--rule)" }}>
          {fields.map(({ key, label }) => {
            const filled = !!slots[key];
            return (
              <div key={key} className="flex items-center gap-1 flex-1 min-w-0" title={`${label}${filled ? " ✓" : ""}`}>
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: filled ? accent : "var(--rule-strong)" }}
                />
                <span
                  className="text-[10px] truncate uppercase tracking-wide font-medium"
                  style={{ color: filled ? "var(--ink)" : "var(--ink-faint)" }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: "200px", maxHeight: "320px" }}>
        {messages.length === 0 && status === "idle" && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Hi! I can help you book a table at {orgName}. What&apos;s your name?
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap leading-relaxed"
              style={
                m.role === "user"
                  ? { backgroundColor: accent, color: "#fff" }
                  : { backgroundColor: "var(--paper-overlay)", color: "var(--ink)" }
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Error fallback */}
      {status === "error" && error && (
        <div className="px-4 py-2 border-t text-xs" style={{ borderColor: "var(--rule)", color: "#f87171", backgroundColor: "rgba(248,113,113,0.08)" }}>
          {error}
        </div>
      )}

      {/* Confirmation summary */}
      {status === "confirming" && slots.name && slots.party_size && slots.date && slots.time && (
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: "var(--rule)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
            Confirm your booking
          </p>
          <div className="space-y-1.5">
            {fields.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</span>
                {editingField === key ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="text-xs px-1.5 py-0.5 rounded border w-24 text-right"
                      style={{ borderColor: "var(--rule)", backgroundColor: "var(--paper)", color: "var(--ink)" }}
                      autoFocus
                    />
                    <button onClick={saveEdit} className="text-xs" style={{ color: accent }}>✓</button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(key)}
                    className="text-xs font-medium text-right hover:underline"
                    style={{ color: "var(--ink)" }}
                  >
                    {key === "name"
                      ? slots.name
                      : key === "party_size"
                      ? `${slots.party_size} guests`
                      : key === "date"
                      ? slots.date
                      : slots.time}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={submitBooking}
              className="flex-1 py-2 rounded-full text-sm font-semibold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: accent }}
            >
              Confirm &amp; Book
            </button>
            <button
              onClick={() => setStatus("collecting")}
              className="py-2 px-3 rounded-full text-sm font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Submitted success */}
      {status === "done" && (
        <div className="px-4 py-5 text-center space-y-2">
          <div
            className="h-10 w-10 rounded-full mx-auto flex items-center justify-center text-white text-xl"
            style={{ backgroundColor: accent }}
          >
            ✓
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Booking confirmed!
          </p>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {slots.name} · {slots.party_size} guests · {slots.date} at {slots.time}
          </p>
          <button
            onClick={() => { setStatus("idle"); setMessages([]); setSlots({ name: null, party_size: null, date: null, time: null }); }}
            className="text-xs underline"
            style={{ color: accent }}
          >
            Book another table
          </button>
        </div>
      )}

      {/* Combo confirmation UI */}
      {status === "waiting_for_combo" && comboDetails && (
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: "var(--rule)" }}>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{comboDetails.message}</p>
          <div className="flex gap-2">
            <button
              onClick={() => submitComboBooking(comboDetails)}
              className="flex-1 py-2 rounded-full text-sm font-semibold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: accent }}
            >
              Yes, proceed
            </button>
            <button
              onClick={() => { setStatus("confirming"); setComboDetails(null); }}
              className="py-2 px-3 rounded-full text-sm font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      {(status === "collecting" || status === "confirming" || status === "waiting_for_combo" || status === "idle" || status === "done") && (
        <div className="px-3 py-3 border-t flex gap-2" style={{ borderColor: "var(--rule)" }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) sendMessage(input); }}
            placeholder="Type your message..."
            className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none focus:border-orange-400 transition-colors"
            style={{ borderColor: "var(--rule)", backgroundColor: "var(--paper)", color: "var(--ink)" }}
          />
          <button
            onClick={() => input.trim() && sendMessage(input)}
            disabled={!input.trim()}
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-30"
            style={{ backgroundColor: accent }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      )}

      {/* Fallback link */}
      {status === "error" && (
        <div className="px-4 py-3 border-t text-center">
          <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
            Having trouble? Book directly:
          </p>
          <a
            href={`/${orgSlug}/reserve`}
            className="text-xs font-medium px-4 py-2 rounded-full inline-block transition-opacity hover:opacity-80"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            Open booking form
          </a>
        </div>
      )}
    </div>
  );
}
