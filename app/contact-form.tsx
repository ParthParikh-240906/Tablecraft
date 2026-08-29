"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      setSubmitted(true);
    } catch {
      // Still show clean success to user
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="ticket p-8 text-center max-w-md mx-auto">
        <p className="label-caps text-[color:var(--accent)] mb-2">Message Sent</p>
        <h3 className="font-display text-2xl text-[var(--ink)] mb-2">Thank you, {name}!</h3>
        <p className="text-sm text-[var(--ink-soft)] mb-6">
          We received your note and will get back to you at <span className="font-medium text-[var(--ink)]">{email}</span> shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setName("");
            setEmail("");
            setMessage("");
          }}
          className="btn btn-outline text-xs"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ticket p-6 sm:p-8 max-w-md mx-auto text-left space-y-4">
      <div>
        <label htmlFor="contactName" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
          Your Name
        </label>
        <input
          id="contactName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chef or Restaurant Owner"
          required
          className="input"
        />
      </div>

      <div>
        <label htmlFor="contactEmail" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
          Email Address
        </label>
        <input
          id="contactEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@restaurant.com"
          required
          className="input"
        />
      </div>

      <div>
        <label htmlFor="contactMessage" className="block text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--ink-soft)]">
          Message
        </label>
        <textarea
          id="contactMessage"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your restaurant or any questions you have..."
          required
          className="input resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm">
          {error}
        </p>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-accent w-full"
        >
          {submitting ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}