"use client";

import { useState } from "react";
import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { newContentElement, newHeroElement, type DesignSettingsV2 } from "@/lib/design";

export function ImageGenPanel({
  orgId,
  initialSettings,
  orgName,
}: {
  orgId: string;
  initialSettings: DesignSettingsV2;
  orgName: string;
}) {
  const { settings, updateSettings, saving, saved } = useDesign(initialSettings, orgId);
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReference = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setReference(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/design/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), imageBase64: reference }),
      });
      const data = await res.json();
      if (res.ok && data.url) setResult(data.url);
      else setError(data.error ?? "Generation failed");
    } catch {
      setError("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const download = async () => {
    if (!result) return;
    try {
      const res = await fetch(result);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tablecraft-generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(result, "_blank");
    }
  };

  const useAsHeroBackground = () => {
    if (!result) return;
    updateSettings({ hero: { ...settings.hero, background: { ...settings.hero.background, type: "image", image_url: result } } });
  };

  const addAsContentImages = () => {
    if (!result) return;
    const el = newContentElement("images");
    el.image_urls = [result];
    el.y = Math.max(...settings.content.elements.map((e) => e.y + e.h), 0) + 2;
    updateSettings({ content: { elements: [...settings.content.elements, el] } });
  };

  const addAsHeroImage = () => {
    if (!result) return;
    const el = newHeroElement("image", 18);
    el.image_url = result;
    updateSettings({ hero: { ...settings.hero, elements: [...settings.hero.elements, el] } });
  };

  return (
    <div>
      <DesignNav />
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Image Generation</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saved ? "✓ Saved" : ""}
            </span>
          </div>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              AI Image Generator
            </h3>
            <p className="text-xs text-[var(--ink-soft)]">
              Describe the image you want. Optionally attach a reference image
              to guide the result. Generated images can be dropped straight
              into your hero, content, or layers.
            </p>

            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Prompt
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A moody restaurant interior, warm candlelight, dark wood tables…"
                className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-3 py-2 text-sm resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Reference Image (optional)
              </label>
              {reference ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reference} alt="Reference" className="h-28 w-full object-cover rounded border border-[var(--rule)]" />
                  <button
                    type="button"
                    onClick={() => setReference(null)}
                    className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1.5 rounded hover:bg-black/80"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="btn btn-outline text-xs cursor-pointer inline-block">
                  Upload reference image
                  <input type="file" accept="image/*" className="hidden" onChange={handleReference} />
                </label>
              )}
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={generating || !prompt.trim()}
              className="btn btn-accent text-sm w-full"
            >
              {generating ? "Generating…" : "Generate Image"}
            </button>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </section>

          {result && (
            <section className="ticket p-5 space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
                Result
              </h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Generated" className="w-full rounded border border-[var(--rule)]" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={download} className="btn btn-outline text-xs">
                  Download
                </button>
                <button type="button" onClick={useAsHeroBackground} className="btn btn-outline text-xs">
                  Use as Hero Background
                </button>
                <button type="button" onClick={addAsContentImages} className="btn btn-outline text-xs">
                  Add to Content Images
                </button>
                <button type="button" onClick={addAsHeroImage} className="btn btn-outline text-xs">
                  Add as Hero Image
                </button>
                <button
                  type="button"
                  onClick={() => { setResult(null); setPrompt(""); setReference(null); }}
                  className="btn btn-outline text-xs text-red-500"
                >
                  Clear
                </button>
              </div>
              <p className="text-[10px] font-mono text-[var(--ink-faint)] break-all">{result}</p>
            </section>
          )}
        </div>

        {/* ── Info ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="ticket p-5 space-y-3">
            <h3 className="font-display text-lg font-semibold text-[var(--ink)]">Quick apply</h3>
            <p className="text-xs text-[var(--ink-soft)]">
              Generated images save instantly into your restaurant design for{" "}
              <span className="text-[var(--ink)]">{orgName}</span>:
            </p>
            <ul className="text-xs text-[var(--ink-soft)] space-y-2">
              <li>• <span className="text-[var(--ink)]">Use as Hero Background</span> — swaps the hero image background.</li>
              <li>• <span className="text-[var(--ink)]">Add to Content Images</span> — new carousel block on the Content page.</li>
              <li>• <span className="text-[var(--ink)]">Add as Hero Image</span> — new image element on the Hero page.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}