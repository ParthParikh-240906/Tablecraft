"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsoleTheme } from "./theme-wrapper";

export interface SidebarOrgItem {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
}

interface ConsoleSidebarProps {
  staffEmail: string;
  staffRole: string;
  userOrgs: SidebarOrgItem[];
  activeOrgId: string;
  isOwner?: boolean;
}

export function ConsoleSidebar({
  staffEmail,
  staffRole,
  userOrgs,
  activeOrgId,
  isOwner = true,
}: ConsoleSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useConsoleTheme();

  // URL param is always fresh (reads current URL); layout prop is stale
  // because the layout cache doesn't vary on searchParams in Next.js 16.
  const orgIdFromUrl = searchParams.get("org");
  // Prefer the URL param for highlighting; fall back to the prop (resolved UUID).
  // The URL param may be a slug — match against both id and slug.
  const activeOrgIdFromProps = orgIdFromUrl || activeOrgId;
  const activeOrgParam = activeOrgIdFromProps ? `?org=${activeOrgIdFromProps}` : "";
  const currentOrg =
    userOrgs.find((o) => o.id === activeOrgIdFromProps || o.slug === activeOrgIdFromProps) ||
    userOrgs.find((o) => o.slug === activeOrgIdFromProps) ||
    userOrgs[0] ||
    { id: "", name: "Restaurant", slug: "" };

  const isHomeActive = pathname === "/console";
  const isConfigActive = pathname === "/console/config" || pathname.startsWith("/console/config/");
  const isPricingActive = pathname === "/console/pricing" || pathname.startsWith("/console/pricing/");

  const cardClass = theme === "light"
    ? "ticket--light p-4 border border-[var(--rule)] bg-[var(--paper-raised)]"
    : "ticket p-4 border border-[var(--rule)] bg-[var(--paper-raised)]";

  const navCardClass = theme === "light"
    ? "ticket--light p-2 border border-[var(--rule)] bg-[var(--paper-raised)] space-y-1"
    : "ticket p-2 border border-[var(--rule)] bg-[var(--paper-raised)] space-y-1";

  const activeLinkClass = "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border border-[var(--accent-border)]";
  const inactiveLinkClass = "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper-overlay)]";

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-6">
      {/* ── Dynamic Title Header ───────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center gap-3">
          {currentOrg.logo_url ? (
            <img
              src={currentOrg.logo_url}
              alt={currentOrg.name}
              className="w-10 h-10 rounded-full object-cover border border-[var(--rule)] bg-[var(--paper)] shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center font-display font-bold text-base shrink-0">
              {currentOrg.name?.[0]?.toUpperCase() ?? "R"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-sm text-[var(--ink)] truncate">
              {currentOrg.name} Console
            </h1>
            <p className="text-[11px] font-mono text-[var(--ink-faint)] truncate">
              {currentOrg.slug ? `/${currentOrg.slug}` : "Restaurant Operations"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Navigation ────────────────────────────────────────── */}
      <nav className={navCardClass}>
        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--ink-faint)]">
          Navigation
        </div>

        {/* Home Button -> /console */}
        <Link
          href={`/console${activeOrgParam}`}
          className={`flex items-center gap-3 px-3 py-2.5 rounded text-xs font-medium transition-colors ${
            isHomeActive ? activeLinkClass : inactiveLinkClass
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Home</span>
        </Link>

        {isOwner && (
          <>
          {/* Configurations Button -> /console/config */}
          <Link
            href={`/console/config${activeOrgParam}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded text-xs font-medium transition-colors ${
              isConfigActive ? activeLinkClass : inactiveLinkClass
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Configurations</span>
          </Link>
          </>
        )}

        {isOwner && (
          <>
          {/* Pricing & Upgrades Button -> /console/pricing */}
          <Link
            href={`/console/pricing${activeOrgParam}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded text-xs font-medium transition-colors ${
              isPricingActive ? activeLinkClass : inactiveLinkClass
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>Pricing & Upgrades</span>
          </Link>
          </>
        )}
     </nav>

      {/* ── Theme Toggle Widget ────────────────────────────────────── */}
      <div className={cardClass.replace("p-4", "p-3").replace("space-y-", "") + " space-y-2"}>
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[var(--ink-faint)]">
          <span>Theme Mode</span>
          <span className="text-[var(--accent)] font-semibold">{theme === "dark" ? "Dark 🌙" : "Light ☀️"}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--paper)] rounded border border-[var(--rule)]">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-all ${
              theme === "dark"
                ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm border border-[var(--rule)] font-semibold"
                : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
            }`}
          >
            <span>🌙</span>
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-all ${
              theme === "light"
                ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm border border-[var(--rule)] font-semibold"
                : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
            }`}
          >
            <span>☀️</span>
            <span>Light</span>
          </button>
        </div>
      </div>

      {/* ── Restaurant Switcher Widget ──────────────────────────────── */}
      {userOrgs.length > 1 && (
        <div className={cardClass.replace("p-4", "p-3").replace("space-y-", "") + " space-y-2"}>
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-[var(--ink-faint)]">
            <span>Switch Restaurant</span>
            <Link href="/console/select" className="text-[var(--accent)] hover:underline text-[10px]">
              View All
            </Link>
          </div>
          <div className="space-y-1">
            {userOrgs.map((org) => {
              const isSelected = org.id === currentOrg.id;
              return (
                <Link
                  key={org.id}
                  href={`${pathname}${activeOrgParam.replace(/org=[^&]*/, `org=${org.id}`) || `?org=${org.id}`}`}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-colors ${
                    isSelected
                      ? `${activeLinkClass}`
                      : `${inactiveLinkClass} border border-transparent`
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-[var(--paper)] flex items-center justify-center text-[10px] font-bold shrink-0 border border-[var(--rule)]">
                    {org.name?.[0]?.toUpperCase() ?? "R"}
                  </div>
                  <span className="truncate flex-1">{org.name}</span>
                  {isSelected && <span className="text-[10px]">✓</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sidebar Footer (Staff Info) ────────────────────────────── */}
      <div className={cardClass.replace("p-4", "p-3")}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono text-[var(--ink-soft)] truncate">{staffEmail}</p>
            <p className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider font-semibold">
              Role: <span className="text-[var(--accent)]">{staffRole}</span>
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
