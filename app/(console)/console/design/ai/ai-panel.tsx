"use client";

import { useState } from "react";
import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { ColorField } from "../design-fields";
import { LOCAL_FONTS, newContentElement, newHeroElement, type DesignSettingsV2 } from "@/lib/design";

export function AiPanel({
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
  const [newFontName, setNewFontName] = useState("");
  const [newFontWeight, setNewFontWeight] = useState("400");
  const [fontStatus, setFontStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [addingFont, setAddingFont] = useState(false);

  const FONT_WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

  const normalizeFamily = (raw: string) => raw.trim().replace(/\s+/g, " ");
  const familyKey = (family: string) => normalizeFamily(family).toLowerCase();

  /** Base family of a stored entry (strips a trailing _400-style suffix if present). */
  const storedBaseKey = (name: string) => {
    const suffix = name.match(/^(.*)_(\d{3,4})$/);
    return familyKey(suffix ? suffix[1] : name);
  };

  const handleAddFont = async () => {
    if (addingFont) return;
    const family = normalizeFamily(newFontName);
    if (!family) return;
    const weightNum = parseInt(newFontWeight, 10);
    if (!FONT_WEIGHTS.includes(String(weightNum))) {
      setFontStatus({ type: "error", message: `Invalid weight "${newFontWeight}" — choose 100–900` });
      return;
    }
    const displayName = normalizeFamily(family);

    const existingCustom = (settings.custom_fonts || []).find(
      (f) => storedBaseKey(f.name) === familyKey(family),
    );
    const existingLocal = LOCAL_FONTS.find((f) => familyKey(f.name) === familyKey(family));
    const existingName = existingCustom?.name ?? existingLocal?.name;
    if (existingName) {
      setFontStatus({ type: "error", message: `You already have ${existingName}` });
      return;
    }

    setAddingFont(true);
    setFontStatus(null);
    try {
      // Validation + download + self-hosting happen server-side
      // (/api/design/fonts/add), so visitor browsers never contact Google.
      const res = await fetch("/api/design/fonts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family, weight: weightNum }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.font) {
        updateSettings({
          custom_fonts: [...(settings.custom_fonts || []), data.font],
        });
        setNewFontName("");
        setFontStatus({ type: "success", message: `${data.font.name} added` });
        return;
      }
      if (data?.code === "weight_unavailable") {
        setFontStatus({
          type: "error",
          message: `Weight ${weightNum} is not available for ${data.family ?? displayName}`,
        });
      } else if (data?.code === "not_found") {
        setFontStatus({ type: "error", message: `${displayName} not found in googlefonts` });
      } else if (data?.code === "unreachable" || !res.ok && res.status >= 500) {
        setFontStatus({
          type: "error",
          message: "Could not reach Google Fonts — check your connection and try again",
        });
      } else {
        setFontStatus({ type: "error", message: data?.error ?? "Could not add font — please try again" });
      }
    } catch {
      setFontStatus({
        type: "error",
        message: "Could not reach Google Fonts — check your connection and try again",
      });
    } finally {
      setAddingFont(false);
    }
  };

  /** Migrate a legacy Google-URL entry to self-hosted files in place. */
  const [migratingFont, setMigratingFont] = useState<string | null>(null);
  const selfHostFont = async (idx: number) => {
    const entry = (settings.custom_fonts || [])[idx];
    if (!entry || entry.css || migratingFont) return;
    const base = entry.name.match(/^(.*)_(\d{3,4})$/)?.[1] ?? entry.name;
    const weights = entry.weight
      ? [entry.weight]
      : (entry.url.match(/wght@([\d;]+)/)?.[1].split(";").map((w) => parseInt(w, 10)) ?? [400]);
    setMigratingFont(entry.name);
    setFontStatus(null);
    try {
      const cssParts: string[] = [];
      let firstUrl = entry.url;
      let canonical = base;
      for (const w of weights.filter((n) => !Number.isNaN(n))) {
        const res = await fetch("/api/design/fonts/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ family: base, weight: w }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.font) {
          setFontStatus({ type: "error", message: `Could not self-host ${entry.name} — please try again` });
          return;
        }
        cssParts.push(data.font.css);
        firstUrl = data.font.url;
        canonical = data.font.name;
      }
      const arr = [...(settings.custom_fonts || [])];
      arr[idx] = { ...entry, name: canonical, value: `'${canonical}', sans-serif`, url: firstUrl, css: cssParts.join("\n") };
      updateSettings({ custom_fonts: arr });
      setFontStatus({ type: "success", message: `${canonical} is now self-hosted ✓` });
    } catch {
      setFontStatus({ type: "error", message: `Could not self-host ${entry.name} — please try again` });
    } finally {
      setMigratingFont(null);
    }
  };

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

  // Chatbot settings
  const chatbot = settings.chatbot ?? {
    color: "#f97316",
    logo_url: null as string | null,
    text_color: "#ffffff",
    text_size: 14,
    font_family: "Inter",
    border_color: "transparent",
    border_width: 0,
  };

  const updateChatbot = (patch: Partial<typeof chatbot>) => {
    updateSettings({ chatbot: { ...chatbot, ...patch } } as Partial<DesignSettingsV2>);
  };

  return (
    <div>
      <DesignNav />
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">AI Tools</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saved ? "✓ Saved" : ""}
            </span>
          </div>

          {/* AI Image Generator */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
              AI Image Generator
            </h3>
            <p className="text-xs text-[var(--ink-soft)]">
              Describe the image you want. Optionally attach a reference image
              to guide the result. Generated images can be dropped straight
              into your hero, content, or layers.
            </p>

            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
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
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
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
              <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
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
              <p className="text-[10px] text-[var(--ink-faint)] break-all">{result}</p>
            </section>
          )}

          {/* AI Chatbot Configurables */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
              AI Chatbot
            </h3>
            <p className="text-xs text-[var(--ink-soft)]">
              Configure the appearance of the AI booking chatbot that appears
              on your restaurant site.
            </p>

            <ColorField
              label="Chatbot Color"
              value={chatbot.color}
              onChange={(v) => updateChatbot({ color: v })}
            />

            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
                Chatbot Logo
              </label>
              <div className="flex items-center gap-2">
                {chatbot.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-black">
                    <img src={chatbot.logo_url} alt="Chatbot logo" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full border-2 border-black" />
                )}
                <label className="btn btn-outline text-xs cursor-pointer inline-block">
                  {chatbot.logo_url ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const form = new FormData();
                      form.append("file", f);
                      form.append("org_id", orgId);
                      const res = await fetch("/api/design/photos/upload", { method: "POST", body: form });
                      if (res.ok) {
                        const data = await res.json();
                        updateChatbot({ logo_url: data.url });
                      }
                    }}
                  />
                </label>
                {chatbot.logo_url && (
                  <button type="button" onClick={() => updateChatbot({ logo_url: null })} className="text-xs text-red-500 underline">
                    Remove
                  </button>
                )}
              </div>
            </div>

            <ColorField
              label="Text Color"
              value={chatbot.text_color}
              onChange={(v) => updateChatbot({ text_color: v })}
            />

            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
                Text Size: {chatbot.text_size}px
              </label>
              <input
                type="range"
                min={10}
                max={24}
                value={chatbot.text_size}
                onChange={(e) => updateChatbot({ text_size: parseInt(e.target.value, 10) })}
                className="w-full accent-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
                Font
              </label>
              <select
                value={chatbot.font_family}
                onChange={(e) => updateChatbot({ font_family: e.target.value })}
                className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs"
              >
                {[...LOCAL_FONTS, ...(settings.custom_fonts || [])].map((f) => (
                  <option key={`${f.name}::${f.value}`} value={f.value}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
                Border Width: {chatbot.border_width ?? 0}px
              </label>
              <input
                type="range"
                min={0}
                max={8}
                value={chatbot.border_width ?? 0}
                onChange={(e) => updateChatbot({ border_width: parseInt(e.target.value, 10) })}
                className="w-full accent-[var(--accent)]"
              />
            </div>

            <ColorField
              label="Border Color"
              value={chatbot.border_color ?? "transparent"}
              onChange={(v) => updateChatbot({ border_color: v })}
            />
          </section>

          {/* Custom Google Fonts */}
          <section className="ticket p-5 space-y-4">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
              Custom Google Fonts
            </h3>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-[var(--ink-soft)] mb-1">
                  Google Font Name (e.g. Sixtyfour, Space Mono)
                </label>
                <input
                  type="text"
                  value={newFontName}
                  onChange={(e) => { setNewFontName(e.target.value); setFontStatus(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddFont();
                    }
                  }}
                  className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs text-[var(--ink)]"
                  placeholder="Roboto"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-soft)] mb-1">
                  Weight
                </label>
                <select
                  value={newFontWeight}
                  onChange={(e) => { setNewFontWeight(e.target.value); setFontStatus(null); }}
                  className="bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1.5 text-xs text-[var(--ink)] h-[30px]"
                >
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void handleAddFont()}
                disabled={addingFont || !newFontName.trim()}
                className="btn btn-outline text-xs h-[30px] disabled:opacity-50"
              >
                {addingFont ? "Adding…" : "Add"}
              </button>
            </div>
            {fontStatus && (
              <p className={`text-xs ${fontStatus.type === "success" ? "text-green-600" : "text-red-500"}`}>
                {fontStatus.type === "success" && <span aria-hidden>✓ </span>}
                {fontStatus.message}
              </p>
            )}
            
            {(settings.custom_fonts || []).length > 0 && (
              <ul className="space-y-1">
                {settings.custom_fonts!.map((font, idx) => (
                  <li key={`${font.name}::${font.url}`} className="flex flex-wrap items-center justify-between gap-2 text-xs py-1 border-b border-[var(--rule)] last:border-0">
                    <span className="text-[var(--ink)]" style={{ fontFamily: font.value }} title={font.url}>
                      {font.name}
                      {font.css
                        ? <span className="ml-1 text-[10px] text-green-600">· self-hosted</span>
                        : <span className="ml-1 text-[10px] text-[var(--ink-faint)]">· via Google</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      {!font.css && (
                        <button
                          type="button"
                          onClick={() => void selfHostFont(idx)}
                          disabled={migratingFont !== null}
                          className="text-[var(--ink-soft)] hover:underline disabled:opacity-50"
                        >
                          {migratingFont === font.name ? "Self-hosting…" : "Self-host"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const arr = [...settings.custom_fonts!];
                          arr.splice(idx, 1);
                          updateSettings({ custom_fonts: arr });
                        }}
                        className="text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-[var(--ink-faint)] leading-relaxed">
              Added fonts become immediately available across all font pickers in the studio. They will be loaded automatically on the preview and public pages.
            </p>
          </section>
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