"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DesignSettingsV2 } from "@/lib/design";
import { normalizeGallery, type GalleryImage } from "@/lib/design";
import type { LiveMenuItem } from "@/lib/built-site";
import type { OrgView } from "@/components/OrgPageView";
import { PreviewShell } from "../preview-shell";

export function WebsiteClient({  orgId,
  orgSlug,
  orgName,
  initialSettings,
  org,
  paragraphs,
  menuItems,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  menuItems: LiveMenuItem[];
}) {
  const [prompt, setPrompt] = useState("");
  const [improvise, setImprovise] = useState("");
  const [showImprovise, setShowImprovise] = useState(false);
  type PreviewEdit = { find: string; replace: string; status: string; summary?: string };
  const [resultEdits, setResultEdits] = useState<PreviewEdit[] | null>(null);
  const [patchedHtml, setPatchedHtml] = useState<string | null>(null);
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);
  const [showPatched, setShowPatched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [vibe, setVibe] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [reconnectDone, setReconnectDone] = useState(false);
  const router = useRouter();

  // Gallery images for edits (same source as the AI panel gallery, by name).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/content/generate?org_id=${encodeURIComponent(orgId)}`);
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data) return;
        const rawItems = Array.isArray(data.galleryItems) ? data.galleryItems : data.gallery;
        if (Array.isArray(rawItems)) setGallery(normalizeGallery(rawItems));
      } catch {
        // Gallery picker is a hint — the prompt works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const colors = {
    bg: initialSettings.background_color,
    text: initialSettings.text_color,
    accent: initialSettings.accent_color,
  };

  async function runEdit(extra?: string) {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setApplyStatus(null);
    try {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, prompt: prompt.trim(), ...(extra ? { improvise: extra } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Edit failed");
        setResultEdits(null);
        return;
      }
      const edits = Array.isArray(data?.edits) ? data.edits : [];
      setResultEdits(edits);
      const hasPatched = typeof data?.patchedHtml === "string" && data.patchedHtml.length > 0;
      setPatchedHtml(hasPatched ? data.patchedHtml : null);
      setPreviewHash(typeof data?.previewHash === "string" ? data.previewHash : null);
      setPreviewLogoUrl(typeof data?.logo_url === "string" && data.logo_url.length > 0 ? data.logo_url : null);
      // Show the result immediately — no hunting for the toggle.
      setShowPatched(hasPatched);
      if (edits.length === 0) {
        setError("The model proposed no edits for this request — try rephrasing with exact text from the page.");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function runApply() {
    if (!resultEdits || resultEdits.length === 0 || applying) return;
    setApplying(true);
    setError(null);
    setApplyStatus(null);
    try {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          prompt: prompt.trim() || "apply",
          preview: false,
          edits: resultEdits.map((e) => ({ find: e.find, replace: e.replace })),
          ...(previewHash ? { previewHash } : {}),
          ...(previewLogoUrl ? { logo_url: previewLogoUrl } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Apply failed — re-run Preview edit");
        return;
      }
      setApplyStatus(
        `Applied ${data?.count ?? resultEdits.length} edit(s)${data?.logo_url ? " + restaurant logo updated" : ""} — preview refreshed.`,
      );
      setResultEdits(null);
      setPreviewLogoUrl(null);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setApplying(false);
    }
  }

  async function runReconnect() {
    if (reconnecting) return;
    setReconnecting(true);
    setReconnectError(null);
    setReconnectDone(false);
    try {
      const res = await fetch("/api/ai/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, orgSlug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setReconnectError(data?.error ?? "Reconnect failed");
        return;
      }
      setReconnectDone(true);
      router.refresh();
    } catch {
      setReconnectError("Network error — please try again");
    } finally {
      setReconnecting(false);
    }
  }

  async function runRebuild() {
    if (!vibe.trim() || rebuilding) return;
    setRebuilding(true);
    setRebuildError(null);
    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name: orgName, orgSlug, vibe: vibe.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRebuildError(data?.error ?? "Rebuild failed");
        return;
      }
      router.refresh();
    } catch {
      setRebuildError("Network error — please try again");
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper-raised)] p-4 space-y-3">
        <label htmlFor="website-prompt" className="block text-sm font-medium">
          Website Edits
        </label>
        <textarea
          id="website-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. Make the hero warmer with a sunset vibe, then fix the menu spacing..."
          className="input w-full"
        />
        {showImprovise && (
          <div>
            <label htmlFor="website-improvise" className="block text-sm font-medium mb-1">
              Improvise instructions
            </label>
            <input
              id="website-improvise"
              value={improvise}
              onChange={(e) => setImprovise(e.target.value)}
              placeholder="Extra direction for improvisation..."
              className="input w-full"
            />
          </div>
        )}
        {gallery.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="website-gallery-url" className="text-xs text-[var(--ink-soft)]">
              Gallery image:
            </label>
            <select
              id="website-gallery-url"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  const picked = gallery.find((g) => g.url === e.target.value);
                  const tag = picked ? `Use image "${picked.name}": ${picked.url}` : `Use this image URL: ${e.target.value}`;
                  setPrompt((p) => `${p}${p.trim() ? "\n" : ""}${tag}`);
                  e.target.value = "";
                }
              }}
              className="input text-xs max-w-full"
            >
              <option value="">Insert a gallery image by name…</option>
              {gallery.map((g) => (
                <option key={g.url} value={g.url}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runEdit()} disabled={loading || !prompt.trim()} className="btn btn-accent text-xs">
            {loading ? "Working..." : "Preview edit"}
          </button>
          <button
            type="button"
            onClick={() => runApply()}
            disabled={applying || !resultEdits || resultEdits.length === 0 || resultEdits.some((e) => e.status !== "matched-once")}
            className="btn btn-accent text-xs disabled:opacity-50"
            title="Writes the previewed edits to the live site"
          >
            {applying ? "Applying..." : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => {
              setResultEdits(null);
              setError(null);
              setApplyStatus(null);
            }}
            className="btn btn-outline text-xs"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => setShowImprovise((v) => !v)}
            className="btn btn-outline text-xs"
          >
            {showImprovise ? "Hide improvise" : "Improvise"}
          </button>
          {showImprovise && (
            <button
              type="button"
              onClick={() => runEdit(improvise)}
              disabled={loading || !prompt.trim()}
              className="btn btn-outline text-xs"
            >
              Run improvise
            </button>
          )}
          <span className="text-xs text-[var(--ink-faint)] ml-auto">
            Apply writes to the live site · {orgSlug ? `/${orgSlug}` : ""}
          </span>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {applyStatus && <p className="text-xs text-green-400">{applyStatus}</p>}
        {resultEdits && resultEdits.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview version">
              <span className="text-xs text-[var(--ink-soft)]">Storefront shows:</span>
              <button
                type="button"
                onClick={() => setShowPatched(false)}
                aria-pressed={!showPatched}
                className={`btn text-xs ${!showPatched ? "btn-accent" : "btn-outline"}`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => patchedHtml && setShowPatched(true)}
                disabled={!patchedHtml}
                aria-pressed={showPatched}
                className={`btn text-xs ${showPatched ? "btn-accent" : "btn-outline"} disabled:opacity-50`}
              >
                With edits
              </button>
              {showPatched && (
                <span className="text-[10px] text-amber-300">Previewing your edits — nothing saved yet</span>
              )}
            </div>
            <ul className="space-y-2">
            {resultEdits.map((edit, i) => (
              <li key={i} className="rounded border border-[var(--rule)] p-2.5 bg-[var(--paper)] text-xs space-y-1.5">
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    edit.status === "matched-once"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : edit.status === "ambiguous"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {edit.status === "matched-once" ? "will apply" : edit.status === "ambiguous" ? "ambiguous anchor" : "no match"}
                </span>
                {edit.summary && (
                  <p className="text-sm font-medium text-[var(--ink)]">{edit.summary}</p>
                )}
                <p className="text-[var(--ink-soft)]">
                  <span className="font-semibold text-[var(--ink)]">Find:</span>{" "}
                  <code className="break-all">{edit.find.length > 220 ? `${edit.find.slice(0, 220)}…` : edit.find}</code>
                </p>
                <p className="text-[var(--ink-soft)]">
                  <span className="font-semibold text-[var(--ink)]">Replace:</span>{" "}
                  <code className="break-all">
                    {edit.replace.length > 220 ? `${edit.replace.slice(0, 220)}…` : edit.replace || "(remove)"}
                  </code>
                </p>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>

      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper-raised)] p-4 space-y-3">
        <label htmlFor="website-rebuild-vibe" className="block text-sm font-medium">
          Rebuild site
        </label>
        <p className="text-xs text-[var(--ink-soft)]">
          Regenerates the full site from your org name, tagline, photos and this vibe. Takes 1–2 minutes and replaces the current built site.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            id="website-rebuild-vibe"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="e.g. warm coastal trattoria…"
            className="input flex-1 min-w-52"
          />
          <button
            type="button"
            onClick={runRebuild}
            disabled={rebuilding || !vibe.trim()}
            className="btn btn-outline text-xs disabled:opacity-50"
          >
            {rebuilding ? "Rebuilding…" : "Rebuild site"}
          </button>
        </div>
        {rebuildError && <p className="text-xs text-red-400">{rebuildError}</p>}
      </div>

      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper-raised)] p-4 space-y-3">
        <label className="block text-sm font-medium">
          Reconnect site
        </label>
        <p className="text-xs text-[var(--ink-soft)]">
          Re-checks endpoint wiring, wires any unwired chatbot stub, and imports the site&apos;s menu items into the
          console — without rebuilding the design. Cheap and fast.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={runReconnect}
            disabled={reconnecting}
            className="btn btn-outline text-xs disabled:opacity-50"
          >
            {reconnecting ? "Reconnecting…" : "Reconnect + import menu"}
          </button>
          {reconnectDone && <p className="text-xs text-green-400">✓ Connected — preview refreshed.</p>}
          {reconnectError && <p className="text-xs text-red-400">{reconnectError}</p>}
        </div>
      </div>

      <PreviewShell
        settings={initialSettings}
        org={org}
        paragraphs={paragraphs}
        colors={colors}
        orgName={orgName}
        menuItems={menuItems}
        srcDocOverride={showPatched ? patchedHtml : null}
        previewBadge={showPatched && !!patchedHtml}
      />
    </div>
  );
}
