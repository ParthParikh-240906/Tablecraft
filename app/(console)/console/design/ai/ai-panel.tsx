"use client";

import { useEffect, useState } from "react";
import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { LOCAL_FONTS, normalizeGallery, type DesignSettingsV2, type GalleryImage } from "@/lib/design";

type ImageRatio = "1:1" | "16:9" | "9:16";
const RATIOS: { value: ImageRatio; label: string }[] = [
  { value: "1:1", label: "Square 1:1" },
  { value: "16:9", label: "Landscape 16:9" },
  { value: "9:16", label: "Portrait 9:16" },
];

type QuotaHint = { used: number; limit: number; remaining: number; plan?: string };

const MAX_GALLERY_ITEMS = 20;

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
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFontName, setNewFontName] = useState("");
  const [newFontWeight, setNewFontWeight] = useState("400");
  const [fontStatus, setFontStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [addingFont, setAddingFont] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Image sizes / gallery / quota
  const [ratio, setRatio] = useState<ImageRatio>("16:9");
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
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
        const rawItems = Array.isArray(data.galleryItems) ? data.galleryItems : data.gallery;
        if (Array.isArray(rawItems)) {
          setGallery(normalizeGallery(rawItems, MAX_GALLERY_ITEMS));
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

  const persistGallery = (next: GalleryImage[]) => {
    setGallery(next);
    // NEW top-level design_settings key (the settings API allows ≤50
    // top-level keys). Deep-merged server-side, so other panels' saves never
    // clobber it.
    updateSettings({ ai_gallery: next } as unknown as Partial<DesignSettingsV2>);
  };

  const autoName = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `generated-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const renameImage = (url: string, name: string) => {
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    persistGallery(gallery.map((g) => (g.url === url ? { ...g, name: clean } : g)));
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

  const generate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/design/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), org_id: orgId, ratio }),
      });
      const data = await res.json();
      if (data?.quota) setImageQuota(data.quota);
      if (res.ok && data.url) {
        setResult(data.url);
        const named: GalleryImage = { url: data.url, name: autoName() };
        persistGallery([named, ...gallery.filter((g) => g.url !== data.url)].slice(0, MAX_GALLERY_ITEMS));
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

  const removeFromGallery = (url: string) => {
    persistGallery(gallery.filter((g) => g.url !== url));
  };

  const uploadToGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError("Image must be under 5MB."); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("org_id", orgId);
      const res = await fetch("/api/design/paragraphs/image", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.url !== "string") {
        setUploadError(data?.error ?? "Upload failed.");
        return;
      }
      const base = file.name.replace(/\.[a-z0-9]+$/i, "").trim().slice(0, 60) || autoName();
      persistGallery([{ url: data.url, name: base }, ...gallery.filter((g) => g.url !== data.url)].slice(0, MAX_GALLERY_ITEMS));
    } catch {
      setUploadError("Upload failed.");
    } finally {
      setUploading(false);
    }
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
              Describe the image you want. Generated images can be dropped straight
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
                <button
                  type="button"
                  onClick={() => { setResult(null); setPrompt(""); }}
                  className="btn btn-outline text-xs text-red-500"
                >
                  Clear
                </button>
              </div>
              <p className="text-[10px] text-[var(--ink-faint)]">
                Saved to your gallery below — name it there (e.g. “logo”), then pick it by name on the Website tab.
              </p>
            </section>
          )}

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

        {/* Right column: gallery */}
        <div className="space-y-8">
          {/* Image Gallery */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">
              Image Gallery
            </h3>
            <p className="text-xs text-[var(--ink-soft)]">
              Every generation is kept here (newest first, up to {MAX_GALLERY_ITEMS}).
              Creation uploads (logo, hero, mobile hero) are added automatically.
              Name each image (e.g. “logo”), then pick it by name on the Website tab.
            </p>
            <div className="flex items-center gap-2">
              <label className="btn btn-outline text-xs cursor-pointer inline-block">
                {uploading ? "Uploading…" : "Upload from device"}
                <input type="file" accept="image/*" className="hidden" onChange={uploadToGallery} disabled={uploading} />
              </label>
              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
            </div>
            {gallery.length === 0 ? (
              <p className="text-xs text-[var(--ink-faint)]">No images yet — generate your first one above.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {gallery.map((item) => (
                  <li key={item.url} className="space-y-1.5 rounded border border-[var(--rule)] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.name} className="h-28 w-full object-cover rounded" />
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGallery((prev) => prev.map((g) => (g.url === item.url ? { ...g, name: v } : g)));
                      }}
                      onBlur={(e) => renameImage(item.url, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          renameImage(item.url, (e.target as HTMLInputElement).value);
                        }
                      }}
                      maxLength={60}
                      aria-label="Image name"
                      className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-1.5 py-1 text-[11px] text-[var(--ink)]"
                    />
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => void downloadUrl(item.url)} className="btn btn-outline text-[10px] px-1.5 py-0.5">
                        Download
                      </button>
                      <button type="button" onClick={() => removeFromGallery(item.url)} className="btn btn-outline text-[10px] px-1.5 py-0.5 text-red-500">
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

      </div>
    </div>
  );
}