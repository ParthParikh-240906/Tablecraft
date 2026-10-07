"use client";

import { useEffect, useState } from "react";
import { useDesign } from "../use-design";
import { useDesignDevice } from "../design-device";
import { DesignNav } from "../design-nav";
import { ColorField } from "../design-fields";
import { LOCAL_FONTS, getFontOverride, newContentElement, newHeroElement, withFontOverride, type DesignSettingsV2, type DeviceKind } from "@/lib/design";

type ImageRatio = "1:1" | "16:9" | "9:16";
const RATIOS: { value: ImageRatio; label: string }[] = [
  { value: "1:1", label: "Square 1:1" },
  { value: "16:9", label: "Landscape 16:9" },
  { value: "9:16", label: "Portrait 9:16" },
];

type QuotaHint = { used: number; limit: number; remaining: number; plan?: string };

const MAX_GALLERY_ITEMS = 3;

export function AiPanel({
  orgId,
  initialSettings,
  orgName,
}: {
  orgId: string;
  initialSettings: DesignSettingsV2;
  orgName: string;
}) {
  const { settings, updateSettings, saving, saved, saveError, retrySave } = useDesign(initialSettings, orgId);
  const { device, setDevice } = useDesignDevice();
  const deviceLabel = device === "tablet" ? "Tablet" : device === "mobile" ? "Mobile" : "Desktop";
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFontName, setNewFontName] = useState("");
  const [newFontWeight, setNewFontWeight] = useState("400");
  const [fontStatus, setFontStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [addingFont, setAddingFont] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Image sizes / gallery / quota
  const [ratio, setRatio] = useState<ImageRatio>("16:9");
  const [gallery, setGallery] = useState<string[]>([]);
  const [imageQuota, setImageQuota] = useState<QuotaHint | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  // Staff-gated meta read: plan quota status and the persisted AI gallery.
  // Never consumes quota.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/content/generate?org_id=${encodeURIComponent(orgId)}`);
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data) return;
        if (data.image) setImageQuota(data.image);
        if (Array.isArray(data.gallery)) {
          setGallery(
            data.gallery
              .filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
              .slice(0, MAX_GALLERY_ITEMS),
          );
        }
      } catch {
        // Meta is a hint — the panel works without it.
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const persistGallery = (next: string[]) => {
    setGallery(next);
    // NEW top-level design_settings key (the settings API allows ≤50
    // top-level keys). Deep-merged server-side, so other panels' saves never
    // clobber it — but hydrateSettings() drops unknown keys, so this local
    // state (seeded from the GET above) is the gallery's source of truth.
    updateSettings({ ai_gallery: next } as unknown as Partial<DesignSettingsV2>);
  };

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
        updateSettings((prev) => ({
          custom_fonts: [...(prev.custom_fonts || []), data.font],
        }));
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
      updateSettings((prev) => {
        // Apply onto latest state so a concurrent font add isn't lost.
        const next = [...(prev.custom_fonts || [])];
        const target = next[idx];
        if (!target) return {};
        next[idx] = { ...target, name: canonical, value: `'${canonical}', sans-serif`, url: firstUrl, css: cssParts.join("\n") };
        return { custom_fonts: next };
      });
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
    if (file.size > 5 * 1024 * 1024) { setError("Reference image exceeds 5MB — compress and try again."); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read reference image — try another file.");
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
        body: JSON.stringify({ prompt: prompt.trim(), imageBase64: reference ?? undefined, org_id: orgId, ratio }),
      });
      const data = await res.json();
      if (data?.quota) setImageQuota(data.quota);
      if (res.ok && data.url) {
        setResult(data.url);
        persistGallery([data.url, ...gallery.filter((u) => u !== data.url)].slice(0, MAX_GALLERY_ITEMS));
      }
      else setError(data.error ?? "Generation failed");
    } catch {
      setError("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadUrl = async (url: string) => {
    setDownloadError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `tablecraft-generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      try {
        window.open(url, "_blank");
      } catch {
        setDownloadError("Could not download image — copy the image URL manually.");
      }
    }
  };

  const download = () => {
    if (!result) return;
    void downloadUrl(result);
  };

  const applyUrlAsHeroBackground = (url: string) => {
    updateSettings({ hero: { ...settings.hero, background: { ...settings.hero.background, type: "image", image_url: url } } });
  };

  const useAsHeroBackground = () => {
    if (!result) return;
    applyUrlAsHeroBackground(result);
  };

  const addUrlAsContentImages = (url: string) => {
    const el = newContentElement("images");
    el.image_urls = [url];
    el.y = Math.max(...settings.content.elements.map((e) => e.y + e.h), 0) + 2;
    updateSettings({ content: { elements: [...settings.content.elements, el] } });
  };

  const addAsContentImages = () => {
    if (!result) return;
    addUrlAsContentImages(result);
  };

  const addUrlAsHeroImage = (url: string) => {
    const el = newHeroElement("image", 18);
    el.image_url = url;
    updateSettings({ hero: { ...settings.hero, elements: [...settings.hero.elements, el] } });
  };

  const addAsHeroImage = () => {
    if (!result) return;
    addUrlAsHeroImage(result);
  };

  const removeFromGallery = (url: string) => {
    persistGallery(gallery.filter((u) => u !== url));
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
              {saving ? "Saving…" : saveError ? "⚠ Not saved" : saved ? "✓ Saved" : ""}
            </span>
          </div>
          {saveError && (
            <div className="rounded-sm border border-red-800 bg-red-950/40 p-2 text-xs text-red-300 flex items-center justify-between gap-2">
              <span>{saveError}</span>
              <button type="button" onClick={() => retrySave()} className="underline shrink-0">Retry</button>
            </div>
          )}


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

            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">
                Aspect Ratio
              </label>
              <div className="flex gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRatio(r.value)}
                    className={`btn text-xs flex-1 ${ratio === r.value ? "btn-accent" : "btn-outline"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={generating || !prompt.trim()}
              className="btn btn-accent text-sm w-full"
            >
              {generating ? "Generating…" : "Generate Image"}
            </button>

            {metaLoading ? (
              <p className="text-[11px] text-[var(--ink-faint)]">Checking monthly AI quota…</p>
            ) : imageQuota ? (
              <p className="text-[11px] text-[var(--ink-faint)]">
                {imageQuota.remaining} of {imageQuota.limit} AI images left this month
                {imageQuota.plan ? ` · ${imageQuota.plan} plan` : ""}
              </p>
            ) : (
              <p className="text-[11px] text-[var(--ink-faint)]">Monthly AI image limits apply by plan.</p>
            )}

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
              <p className="text-[10px] text-[var(--ink-faint)]">
                Clear only hides this preview — the image is kept in your gallery below.
              </p>
            </section>
          )}

          {/* Image Gallery */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
              Image Gallery
            </h3>
            <p className="text-xs text-[var(--ink-soft)]">
              Every generation is kept here (newest first, up to {MAX_GALLERY_ITEMS}).
              Apply any image straight into your design.
            </p>
            {gallery.length === 0 ? (
              <p className="text-xs text-[var(--ink-faint)]">No images yet — generate your first one above.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {gallery.map((url) => (
                  <li key={url} className="space-y-1.5 rounded border border-[var(--rule)] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="AI generated" className="h-28 w-full object-cover rounded" />
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => applyUrlAsHeroBackground(url)} className="btn btn-outline text-[10px] px-1.5 py-0.5">
                        Hero BG
                      </button>
                      <button type="button" onClick={() => addUrlAsContentImages(url)} className="btn btn-outline text-[10px] px-1.5 py-0.5">
                        Content
                      </button>
                      <button type="button" onClick={() => addUrlAsHeroImage(url)} className="btn btn-outline text-[10px] px-1.5 py-0.5">
                        Hero Img
                      </button>
                      <button type="button" onClick={() => void downloadUrl(url)} className="btn btn-outline text-[10px] px-1.5 py-0.5">
                        Download
                      </button>
                      <button type="button" onClick={() => removeFromGallery(url)} className="btn btn-outline text-[10px] px-1.5 py-0.5 text-red-500">
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
                      setLogoError(null);
                      if (f.size > 5 * 1024 * 1024) { setLogoError("Logo exceeds 5MB — compress and try again."); e.target.value = ""; return; }
                      try {
                        const form = new FormData();
                        form.append("file", f);
                        form.append("org_id", orgId);
                        const res = await fetch("/api/design/photos/upload", { method: "POST", body: form });
                        if (res.ok) {
                          const data = await res.json();
                          updateChatbot({ logo_url: data.url });
                        } else {
                          const data = await res.json().catch(() => null);
                          setLogoError(data?.error ?? `Logo upload failed (${res.status}). Try again.`);
                        }
                      } catch {
                        setLogoError("Network error — logo not uploaded. Try again.");
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
              {logoError && (
                <p className="text-xs text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm">{logoError}</p>
              )}
              {downloadError && (
                <p className="text-xs text-red-400 border border-red-800 bg-red-950/40 p-2 rounded-sm">{downloadError}</p>
              )}
            </div>

            <ColorField
              label="Text Color"
              value={chatbot.text_color}
              onChange={(v) => updateChatbot({ text_color: v })}
            />

            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <label className="block text-xs text-[var(--ink-soft)]">
                  Text Size: {device !== "desktop" ? (getFontOverride(settings.responsive, device, "chatbot.text") ?? chatbot.text_size) : chatbot.text_size}px
                </label>
                {/* This panel has no storefront preview, so it owns a compact
                    device switch for the per-device chatbot text size. */}
                <div role="group" aria-label="Chatbot text size device" className="flex items-center gap-1">
                  {(["desktop", "tablet", "mobile"] as const).map((d: DeviceKind) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDevice(d)}
                      aria-pressed={device === d}
                      className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                        device === d
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--rule)] text-[var(--ink-soft)]"
                      }`}
                    >
                      {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablet" : "Mobile"}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min={10}
                max={24}
                value={device !== "desktop" ? (getFontOverride(settings.responsive, device, "chatbot.text") ?? chatbot.text_size) : chatbot.text_size}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  if (!Number.isFinite(next)) return;
                  if (device !== "desktop") {
                    updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "chatbot.text", next) }));
                  } else {
                    updateChatbot({ text_size: next });
                  }
                }}
                className="w-full accent-[var(--accent)]"
              />
              {device !== "desktop" && (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <p className="text-[10px] text-[var(--ink-faint)]">
                    {deviceLabel}: {getFontOverride(settings.responsive, device, "chatbot.text") != null ? "custom" : `inherits desktop (${chatbot.text_size}px)`}
                  </p>
                  {getFontOverride(settings.responsive, device, "chatbot.text") != null && (
                    <button
                      type="button"
                      onClick={() => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "chatbot.text", undefined) }))}
                      className="text-[10px] underline text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      Reset (inherits)
                    </button>
                  )}
                </div>
              )}
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
                          updateSettings((prev) => ({
                            custom_fonts: (prev.custom_fonts || []).filter((_, i) => i !== idx),
                          }));
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
              <li>• <span className="text-[var(--ink)]">Gallery</span> — every generation is kept (newest first, up to {MAX_GALLERY_ITEMS}); Delete only removes it from the gallery.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}