"use client";

import { useState } from "react";
import type { DesignSettingsV2 } from "@/lib/design";
import type { OrgView } from "@/components/OrgPageView";
import { PreviewShell } from "../preview-shell";
import { ChatbotPreview } from "./chatbot-preview";

export function WebsiteClient({
  orgId,
  orgSlug,
  orgName,
  initialSettings,
  org,
  paragraphs,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
}) {
  const [prompt, setPrompt] = useState("");
  const [improvise, setImprovise] = useState("");
  const [showImprovise, setShowImprovise] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    bg: initialSettings.background_color,
    text: initialSettings.text_color,
    accent: initialSettings.accent_color,
  };

  async function runEdit(extra?: string) {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, prompt: prompt.trim(), ...(extra ? { improvise: extra } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Edit failed");
        return;
      }
      setResult(typeof data?.raw === "string" ? data.raw : JSON.stringify(data).slice(0, 8000));
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--rule)] bg-[var(--paper-raised)] p-4 space-y-3">
        <label htmlFor="website-prompt" className="block text-sm font-medium">
          Edit prompt (GPT 6.1 Sol, high effort)
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
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runEdit()} disabled={loading || !prompt.trim()} className="btn btn-accent text-xs">
            {loading ? "Working..." : "Preview edit"}
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
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
            Approve applies via design APIs · {orgSlug ? `/${orgSlug}` : ""}
          </span>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-auto rounded border border-[var(--rule)] p-3 bg-[var(--paper)]">
            {result}
          </pre>
        )}
      </div>

      <PreviewShell settings={initialSettings} org={org} paragraphs={paragraphs} colors={colors} orgName={orgName} />

      <ChatbotPreview settings={initialSettings} orgName={orgName} />
    </div>
  );
}
