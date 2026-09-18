"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useDesign } from "../design/use-design";
import { useConsoleTheme } from "../theme-wrapper";
import { defaultBookingConfig, type BookingConfigDesign, type DesignSettingsV2 } from "@/lib/design";

export interface ConfigOrgItem {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
}

export function ConfigPanel({
  orgId,
  orgName,
  initialSettings,
  userOrgs,
  ownerEmail,
  staffEmail,
}: {
  orgId: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
  userOrgs: ConfigOrgItem[];
  ownerEmail: string;
  staffEmail: string;
}) {
  const { settings, updateSettings, saving, saved } = useDesign(initialSettings, orgId);
  const { theme, setTheme } = useConsoleTheme();
  const [staffEmailInput, setStaffEmailInput] = useState(staffEmail);

  // Sync local input when parent passes a new email (org switch)
  useEffect(() => {
    setStaffEmailInput(staffEmail);
  }, [staffEmail]);

  const bookingConfig: BookingConfigDesign = settings.booking_config ?? defaultBookingConfig();

  const updateBookingConfig = (patch: Partial<BookingConfigDesign>) => {
    updateSettings({
      booking_config: {
        ...bookingConfig,
        ...patch,
      },
    } as Partial<DesignSettingsV2>);
  };

  const bufferPresets = [
    { label: "30 mins", value: 30 },
    { label: "1 hour", value: 60 },
    { label: "1.5 hours", value: 90 },
    { label: "2 hours", value: 120 },
    { label: "3 hours", value: 180 },
  ];

  const durationPresets = [
    { label: "1 hour", value: 60 },
    { label: "1.5 hours", value: 90 },
    { label: "2 hours", value: 120 },
    { label: "2.5 hours", value: 150 },
    { label: "3 hours", value: 180 },
    { label: "4 hours", value: 240 },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--rule)]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)]">
            Configurations
          </h1>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Manage reservation timing rules, console themes, and active restaurant settings for {orgName}.
          </p>
        </div>
        <span className="text-xs font-mono text-[var(--accent)]">
          {saving ? "Saving…" : saved ? "✓ Saved" : ""}
        </span>
      </div>

      {/* ── Section 1: Reservation Timing Rules ─────────────────────── */}
      <section className="ticket p-6 space-y-6 border border-[var(--rule)] bg-[var(--paper-raised)]">
        <div className="border-b border-[var(--rule)] pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
              Reservation Timing & Table Holding Rules
            </h2>
          </div>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Configure how early tables get locked prior to guests arriving and how long reservations stay active.
          </p>
        </div>

        {/* Advance Buffer Before Booking */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink)] mb-1">
              Pre-Reservation Lock Buffer
            </label>
            <p className="text-xs text-[var(--ink-faint)]">
              How much advance time before the booking datetime the table gets reserved and locked from walk-in seatings.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {bufferPresets.map((preset) => {
              const active = bookingConfig.buffer_before_minutes === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateBookingConfig({ buffer_before_minutes: preset.value })}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    active
                      ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
                      : "bg-[var(--paper)] text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--rule)]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-[var(--ink-soft)]">Custom buffer (minutes):</span>
            <input
              type="number"
              min={10}
              max={720}
              step={5}
              value={bookingConfig.buffer_before_minutes ?? 120}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0) {
                  updateBookingConfig({ buffer_before_minutes: val });
                }
              }}
              className="input w-28 text-xs py-1 px-2 border border-[var(--rule)] bg-[var(--paper)] rounded"
            />
            <span className="text-xs text-[var(--ink-faint)]">
              ({Math.floor((bookingConfig.buffer_before_minutes ?? 120) / 60)}h {(bookingConfig.buffer_before_minutes ?? 120) % 60}m prior)
            </span>
          </div>
        </div>

        <hr className="border-[var(--rule)]" />

        {/* No Time Limit Option */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 p-4 rounded bg-[var(--paper)] border border-[var(--rule)]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[var(--ink)]">
                  No Time Limit Option
                </span>
                {bookingConfig.no_time_limit && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ink-faint)] mt-1">
                Keep the table reserved for the guest as long as they stay without any fixed end-time limit.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={bookingConfig.no_time_limit ?? false}
                onChange={(e) => updateBookingConfig({ no_time_limit: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>
        </div>

        {/* Reservation Duration (when not unlimited) */}
        {!bookingConfig.no_time_limit && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink)] mb-1">
                Reservation Duration
              </label>
              <p className="text-xs text-[var(--ink-faint)]">
                Standard time window allocated per booking. Tables will be held for this duration before becoming available.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {durationPresets.map((preset) => {
                const active = bookingConfig.duration_minutes === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => updateBookingConfig({ duration_minutes: preset.value })}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      active
                        ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
                        : "bg-[var(--paper)] text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--rule)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-[var(--ink-soft)]">Custom duration (minutes):</span>
              <input
                type="number"
                min={30}
                max={720}
                step={15}
                value={bookingConfig.duration_minutes ?? 120}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0) {
                    updateBookingConfig({ duration_minutes: val });
                  }
                }}
                className="input w-28 text-xs py-1 px-2 border border-[var(--rule)] bg-[var(--paper)] rounded"
              />
              <span className="text-xs text-[var(--ink-faint)]">
                ({Math.floor((bookingConfig.duration_minutes ?? 120) / 60)}h {(bookingConfig.duration_minutes ?? 120) % 60}m duration)
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Section 2: Theme Settings ───────────────────────────────── */}
      <section className="ticket p-6 space-y-4 border border-[var(--rule)] bg-[var(--paper-raised)]">
        <div className="border-b border-[var(--rule)] pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </span>
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
              Console Appearance & Theme
            </h2>
          </div>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Toggle between Dark and Light mode for the operator console. Persists across your sessions.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <div
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-lg cursor-pointer transition-all border ${
              theme === "dark"
                ? "border-[var(--accent)] bg-[#0f0b09] shadow-md ring-2 ring-[var(--accent)]/20"
                : "border-[var(--rule)] bg-[#0f0b09]/50 hover:border-stone-500"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <span>🌙</span> Dark Mode
              </span>
              {theme === "dark" && (
                <span className="text-xs font-bold text-[var(--accent)]">✓ Active</span>
              )}
            </div>
            <p className="text-xs text-stone-400">
              Deep espresso & midnight palette. High contrast, easy on the eyes in dimly lit restaurant floors.
            </p>
          </div>

          <div
            onClick={() => setTheme("light")}
            className={`p-4 rounded-lg cursor-pointer transition-all border ${
              theme === "light"
                ? "border-[var(--accent)] bg-white text-stone-900 shadow-md ring-2 ring-[var(--accent)]/20"
                : "border-[var(--rule)] bg-white/90 text-stone-900 hover:border-stone-400"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <span>☀️</span> Light Mode
              </span>
              {theme === "light" && (
                <span className="text-xs font-bold text-[var(--accent)]">✓ Active</span>
              )}
            </div>
            <p className="text-xs text-stone-600">
              Crisp alabaster & warm paper palette. Clean presentation for bright daytime environments.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: Restaurant Switcher ──────────────────────────── */}
      {userOrgs.length > 1 && (
        <section className="ticket p-6 space-y-4 border border-[var(--rule)] bg-[var(--paper-raised)]">
          <div className="border-b border-[var(--rule)] pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
                Multi-Restaurant Console Switcher
              </h2>
            </div>
            <p className="text-xs text-[var(--ink-soft)] mt-1">
              Quickly switch your active management session to another restaurant under your account.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            {userOrgs.map((org) => {
              const isCurrent = org.id === orgId;
              return (
                <Link
                  key={org.id}
                  href={`/console?org=${org.id}`}
                  className={`p-4 rounded-lg flex items-center gap-3 transition-all border ${
                    isCurrent
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]"
                      : "border-[var(--rule)] bg-[var(--paper)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-10 h-10 rounded-full object-cover border border-[var(--rule)] bg-[var(--paper-raised)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--paper-raised)] text-[var(--ink)] border border-[var(--rule)] flex items-center justify-center font-bold text-sm shrink-0">
                      {org.name?.[0]?.toUpperCase() ?? "R"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs text-[var(--ink)] truncate">{org.name}</p>
                    <p className="text-[11px] font-mono text-[var(--ink-faint)] truncate">/{org.slug}</p>
                  </div>
                  {isCurrent ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent)] text-white">
                      Current
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--accent)] font-medium hover:underline">
                      Switch →
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Owner Account Section ─────────────────────────────────── */}
      <section className="ticket p-6 border border-[var(--rule)] bg-[var(--paper-raised)] space-y-5">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Owner Account</h2>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-1">
            Owner email
          </label>
          <p className="text-sm text-[var(--ink)] font-mono">{ownerEmail}</p>
        </div>

        <div>
          <label htmlFor="ownerPassword" className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-1">
            New password <span className="text-[var(--ink-faint)] font-normal normal-case">(optional)</span>
          </label>
          <input
            id="ownerPassword"
            type="password"
            placeholder="At least 8 characters"
            className="input placeholder:text-[var(--ink-faint)] w-full max-w-sm"
          />
        </div>

        <button
          type="button"
          onClick={async () => {
            const pwd = (document.getElementById("ownerPassword") as HTMLInputElement)?.value;
            if (!pwd) return;
            const res = await fetch("/api/account/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ section: "owner", password: pwd }),
            });
            const data = await res.json();
            if (!res.ok) alert(data.error ?? "Update failed");
          }}
          className="btn btn-accent text-xs px-4 py-2"
        >
          Save Owner Account
        </button>
      </section>

      {/* ── Staff Account Section ─────────────────────────────────── */}
      <section className="ticket p-6 border border-[var(--rule)] bg-[var(--paper-raised)] space-y-5">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Staff Account</h2>

        <div>
          <label htmlFor="staffEmail" className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-1">
            Staff email
          </label>
          <input
            id="staffEmail"
            type="email"
            value={staffEmailInput}
            onChange={(e) => setStaffEmailInput(e.target.value)}
            placeholder="Enter staff email"
            className="input placeholder:text-[var(--ink-faint)] w-full max-w-sm"
          />
        </div>

        <div>
          <label htmlFor="staffPassword" className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-1">
            New password <span className="text-[var(--ink-faint)] font-normal normal-case">(optional)</span>
          </label>
          <input
            id="staffPassword"
            type="password"
            placeholder="At least 8 characters"
            className="input placeholder:text-[var(--ink-faint)] w-full max-w-sm"
          />
        </div>

        <button
          type="button"
          onClick={async () => {
            const newEmail = staffEmailInput.trim();
            const pwd = (document.getElementById("staffPassword") as HTMLInputElement)?.value;
            if (!newEmail && !pwd) return;
            const res = await fetch("/api/account/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ section: "staff", email: newEmail || undefined, password: pwd || undefined }),
            });
            const data = await res.json();
            if (!res.ok) alert(data.error ?? "Update failed");
          }}
          className="btn btn-accent text-xs px-4 py-2"
        >
          Save Staff Account
        </button>
      </section>
    </div>
  );
}
