"use client";

import { useEffect, useRef, useState } from "react";
import type { DomainRow } from "@/lib/domain-store";

type DnsRecord = { type: string; name: string; value: string; purpose: string };

const STATUS: Record<string, { label: string; className: string; hint: string }> = {
  pending_dns: {
    label: "Waiting for DNS",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    hint: "Add the records below at your DNS provider. We'll check automatically.",
  },
  verifying: {
    label: "Verifying",
    className: "bg-sky-500/10 text-sky-600 border-sky-500/30",
    hint: "Vercel is checking DNS and issuing the SSL certificate.",
  },
  active: {
    label: "Connected",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    hint: "Your domain is live over HTTPS.",
  },
  error: {
    label: "Needs attention",
    className: "bg-rose-500/10 text-rose-600 border-rose-500/30",
    hint: "Vercel reported a problem. Check the DNS records and try again.",
  },
};

function statusFor(status: string) {
  return STATUS[status] ?? STATUS.pending_dns;
}

function recordsFor(domain: DomainRow): DnsRecord[] {
  if (!Array.isArray(domain.dns_records)) return [];
  return domain.dns_records.filter((r): r is DnsRecord => {
    if (!r || typeof r !== "object") return false;
    const row = r as Record<string, unknown>;
    return typeof row.type === "string" && typeof row.name === "string" && typeof row.value === "string";
  });
}

export function LaunchClient({
  orgId,
  orgSlug,
  orgName,
  plan,
  domains: initialDomains,
  platformBaseUrl,
  vercelConfigured,
  schemaReady,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
  plan: "free" | "pro" | "max";
  domains: DomainRow[];
  platformBaseUrl: string;
  vercelConfigured: boolean;
  schemaReady: boolean;
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const busyRef = useRef(false);

  const domain = domains[0] ?? null;
  const isPaid = plan === "pro" || plan === "max";
  const siteUrl = `${platformBaseUrl}/${orgSlug}`;
  const status = domain ? statusFor(domain.status) : null;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  // Poll pending domains so the card flips to Connected without a manual reload.
  useEffect(() => {
    const pending = domains.find((d) => d.status === "pending_dns" || d.status === "verifying");
    if (!pending) return;
    let cancelled = false;
    const tick = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const res = await fetch(`/api/domains/${pending.id}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgSlug }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.domain) {
          setDomains((cur) => cur.map((d) => (d.id === data.domain.id ? data.domain : d)));
        }
      } catch {
        // silent — the manual Check status button surfaces errors
      } finally {
        busyRef.current = false;
      }
    };
    const id = setInterval(tick, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [domains, orgSlug]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch {
      setError("Could not copy — select the value manually.");
    }
  };

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname.trim() || adding) return;
    busyRef.current = true;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, hostname }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not connect the domain.");
      if (data?.domain) setDomains([data.domain]);
      if (data?.warning) setNotice(data.warning);
      setHostname("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect the domain.");
    } finally {
      busyRef.current = false;
      setAdding(false);
    }
  };

  const verifyDomain = async (id: string) => {
    busyRef.current = true;
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/domains/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not check the domain.");
      if (data?.domain) {
        setDomains((cur) => cur.map((d) => (d.id === data.domain.id ? data.domain : d)));
        if (data.domain.status === "active") setNotice("Domain connected. Your site is live over HTTPS.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the domain.");
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const disconnectDomain = async (id: string) => {
    if (!window.confirm("Disconnect this domain? The restaurant will stay live on its Tablecraft URL.")) return;
    busyRef.current = true;
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/domains/${id}?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not disconnect the domain.");
      setDomains([]);
      setNotice("Domain disconnected. It may take a few minutes for DNS to stop resolving.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect the domain.");
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const records = domain ? recordsFor(domain) : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--rule)]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)]">Launch</h1>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Put {orgName} on a domain you own. DNS and SSL are handled by Vercel.
          </p>
        </div>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline text-xs py-1.5 px-3"
        >
          Open current site →
        </a>
      </div>

      {error && (
        <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2" aria-label="Dismiss">✕</button>
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold ml-2" aria-label="Dismiss">✕</button>
        </div>
      )}

      {!vercelConfigured && (
        <div className="p-4 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs">
          <p className="font-semibold mb-1">Domain management is not configured</p>
          <p>
            Add <code className="font-mono">VERCEL_TOKEN</code> and{" "}
            <code className="font-mono">VERCEL_PROJECT_ID</code> to the server environment, then reload.
          </p>
        </div>
      )}

      {!schemaReady && (
        <div className="p-4 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs">
          <p className="font-semibold mb-1">Database migration required</p>
          <p>
            Apply <code className="font-mono">supabase/migrations/0037_custom_domains_and_sessions.sql</code>{" "}
            (or run <code className="font-mono">npx supabase db push</code>), then reload this page.
          </p>
        </div>
      )}

      <section className="ticket p-5 border border-[var(--rule)] bg-[var(--paper-raised)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--ink)]">Your Tablecraft site</p>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)]">
            {isPaid ? "Live" : "Free / mock"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs font-mono bg-[var(--paper)] border border-[var(--rule)] rounded px-2.5 py-1.5 break-all">
            {siteUrl}
          </code>
          <button type="button" onClick={() => copy(siteUrl, "site")} className="btn btn-outline text-[11px] py-1 px-2.5">
            {copied === "site" ? "Copied" : "Copy"}
          </button>
        </div>
        {!isPaid && (
          <p className="text-[11px] text-[var(--ink-faint)]">
            Free includes a mock site and console, with 2 combined active sessions. Upgrade to connect a real domain.
          </p>
        )}
      </section>

      {!isPaid && (
        <section className="ticket p-5 border border-[var(--accent-border)] bg-[var(--accent-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">Custom domains are a Pro feature</p>
            <p className="text-[11px] text-[var(--ink-soft)] mt-1">
              Pro and Max include 1 custom domain per restaurant. Free stays on the Tablecraft URL.
            </p>
          </div>
          <a href={`/console/pricing?org=${orgId}`} className="btn btn-accent text-xs py-1.5 px-3">
            View plans →
          </a>
        </section>
      )}

      {domain ? (
        <section className="ticket p-5 border border-[var(--rule)] bg-[var(--paper-raised)] space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--ink)]">Connected domain</p>
              <p className="font-display text-lg text-[var(--ink)] mt-1 break-all">{domain.hostname}</p>
              {domain.alternate_hostname && (
                <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">
                  {domain.alternate_hostname} redirects to {domain.hostname}
                </p>
              )}
            </div>
            {status && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${status.className}`}>
                {status.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {domain.status === "active" && (
              <a
                href={`https://${domain.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent text-xs py-1.5 px-3"
              >
                Open live site →
              </a>
            )}
            <button
              type="button"
              onClick={() => verifyDomain(domain.id)}
              disabled={busyId === domain.id}
              className="btn btn-outline text-xs py-1.5 px-3"
            >
              {busyId === domain.id ? "Checking…" : "Check status"}
            </button>
            <button
              type="button"
              onClick={() => disconnectDomain(domain.id)}
              disabled={busyId === domain.id}
              className="btn btn-outline text-xs py-1.5 px-3 text-rose-500 border-rose-300 hover:border-rose-400"
            >
              Disconnect
            </button>
          </div>

          {status && <p className="text-[11px] text-[var(--ink-soft)]">{status.hint}</p>}

          {domain.last_error && (
            <p className="text-[11px] text-rose-500 break-words">{domain.last_error}</p>
          )}

          {records.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--ink)]">DNS records</p>
              <div className="overflow-x-auto rounded border border-[var(--rule)]">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-[var(--paper)] text-[var(--ink-faint)] font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Value</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rule)]">
                    {records.map((r, i) => {
                      const key = `${r.type}-${r.name}-${i}`;
                      return (
                        <tr key={key}>
                          <td className="py-2 px-3 font-mono font-semibold">{r.type}</td>
                          <td className="py-2 px-3 font-mono break-all">{r.name}</td>
                          <td className="py-2 px-3 font-mono break-all">{r.value}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => copy(r.value, key)}
                              className="text-[var(--accent)] hover:underline"
                            >
                              {copied === key ? "Copied" : "Copy"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[var(--ink-faint)]">
                Keep Cloudflare&apos;s proxy off (DNS only) until the domain shows Connected. SSL is issued automatically.
              </p>
            </div>
          )}
        </section>
      ) : (
        isPaid && (
          <section className="ticket p-5 border border-[var(--rule)] bg-[var(--paper-raised)] space-y-4">
            <div>
              <p className="text-xs font-semibold text-[var(--ink)]">Connect a domain</p>
              <p className="text-[11px] text-[var(--ink-soft)] mt-1">
                Enter the domain you own. We&apos;ll add the apex and <span className="font-mono">www</span> records, then show you what to paste into your DNS provider.
              </p>
            </div>
            <form onSubmit={addDomain} className="flex flex-col sm:flex-row gap-2">
              <input
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="example.com"
                autoComplete="off"
                spellCheck={false}
                disabled={!vercelConfigured || !schemaReady}
                className="flex-1 rounded border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!vercelConfigured || !schemaReady || adding || !hostname.trim()}
                className="btn btn-accent text-xs py-2 px-4 disabled:opacity-50"
              >
                {adding ? "Connecting…" : "Connect domain"}
              </button>
            </form>
            <p className="text-[10px] text-[var(--ink-faint)]">
              1 domain per restaurant. You can move your DNS back at any time.
            </p>
          </section>
        )
      )}

      <section className="ticket p-5 border border-[var(--rule)] bg-[var(--paper)] space-y-2">
        <p className="text-xs font-semibold text-[var(--ink)]">How it works</p>
        <ol className="text-[11px] text-[var(--ink-soft)] space-y-1.5 list-decimal pl-4">
          <li>Add the domain here; we attach it to the Tablecraft deployment.</li>
          <li>Paste the A/CNAME records into your DNS provider.</li>
          <li>Vercel verifies ownership and issues SSL automatically.</li>
          <li>Your restaurant opens on the custom domain; the Tablecraft URL keeps working.</li>
        </ol>
        <p className="text-[10px] text-[var(--ink-faint)]">
          DNS changes can take a few minutes to 48 hours. Existing A/AAAA records for the same hostname should be removed.
        </p>
      </section>
    </div>
  );
}
