"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { RestaurantPhotoCarousel } from "@/components/RestaurantPhotoCarousel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TextDesign {
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: "left" | "center" | "right";
}

const DEFAULT_TEXT_DESIGN: TextDesign = {
  fontFamily: "Inter",
  fontSize: 18,
  color: "#f5f5f4",
  textAlign: "center",
};

const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Poppins:wght@400;700&family=Playfair+Display:wght@400;700&family=Lora:wght@400;700&family=Roboto+Slab:wght@400;700&family=Merriweather:wght@400;700&family=Open+Sans:wght@400;700&family=Montserrat:wght@400;700&family=Raleway:wght@400;700&family=Ubuntu:wght@400;700&display=swap";

const GOOGLE_FONTS = [
  { name: "Inter", value: "'Inter', sans-serif" },
  { name: "Poppins", value: "'Poppins', sans-serif" },
  { name: "Playfair Display", value: "'Playfair Display', serif" },
  { name: "Lora", value: "'Lora', serif" },
  { name: "Roboto Slab", value: "'Roboto Slab', serif" },
  { name: "Merriweather", value: "'Merriweather', serif" },
  { name: "Open Sans", value: "'Open Sans', sans-serif" },
  { name: "Montserrat", value: "'Montserrat', sans-serif" },
  { name: "Raleway", value: "'Raleway', sans-serif" },
  { name: "Ubuntu", value: "'Ubuntu', sans-serif" },
];

interface ParagraphRow {
  id: string;
  position: number;
  title: string | null;
  content: string | null;
  image_url: string | null;
  image_position: "text-left" | "text-right";
  title_design: TextDesign | null;
  content_design: TextDesign | null;
}

interface DesignSettings {
  background_color: string;
  text_color: string;
  accent_color: string;
  name_design: TextDesign;
  tagline_design: TextDesign;
  about_title_design: TextDesign;
  about_content_design: TextDesign;
  contact_heading_design: TextDesign;
  contact_body_design: TextDesign;
}

const DEFAULT_SETTINGS: DesignSettings = {
  background_color: "#141414",
  text_color: "#f5f5f4",
  accent_color: "#f97316",
  name_design: { ...DEFAULT_TEXT_DESIGN, fontSize: 48, textAlign: "center" },
  tagline_design: { ...DEFAULT_TEXT_DESIGN, fontSize: 20, textAlign: "center" },
  about_title_design: { ...DEFAULT_TEXT_DESIGN, fontSize: 30 },
  about_content_design: { ...DEFAULT_TEXT_DESIGN, fontSize: 16 },
  contact_heading_design: { ...DEFAULT_TEXT_DESIGN, fontSize: 28, textAlign: "center" },
  contact_body_design: { ...DEFAULT_TEXT_DESIGN, fontSize: 15 },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function DesignField({
  label,
  design,
  onChange,
}: {
  label: string;
  design: TextDesign;
  onChange: (d: TextDesign) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-3 items-end">
      <div className="col-span-1">
        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
          {label}
        </label>
        <select
          value={design.fontFamily}
          onChange={(e) => onChange({ ...design, fontFamily: e.target.value })}
          className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
        >
          {GOOGLE_FONTS.map((f) => (
            <option key={f.value} value={f.name}>{f.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
          Size (px)
        </label>
        <input
          type="number"
          min={8}
          max={120}
          value={design.fontSize}
          onChange={(e) =>
            onChange({ ...design, fontSize: parseInt(e.target.value) || 12 })
          }
          className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
          Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={design.color}
            onChange={(e) => onChange({ ...design, color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs font-mono text-[var(--ink-soft)]">{design.color}</span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
          Align
        </label>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ ...design, textAlign: a })}
              className={`flex-1 py-1 text-xs border rounded transition-colors ${
                design.textAlign === a
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--ink)]"
              }`}
            >
              {a[0].toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-mono text-[var(--ink-soft)] w-32 shrink-0">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-2 py-1 text-sm font-mono"
      />
    </div>
  );
}

// ─── Preview (mirrors public page structure) ────────────────────────────────

function PreviewSection({
  settings,
  orgName,
  text,
  paragraphs,
  photoUrls,
  backgroundImageUrl,
  logoUrl,
  bgKey,
}: {
  settings: DesignSettings;
  orgName: string;
  text: { tagline: string; about_title: string; about_text: string; contact_heading: string; location: string; contact_phone: string; contact_email: string; contact_address: string };
  paragraphs: ParagraphRow[];
  photoUrls: string[];
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
  bgKey: number;
}) {
  const main = settings.background_color;
  const textColor = settings.text_color;
  const accent = settings.accent_color;

  const style = (d: TextDesign) => ({
    fontFamily: d.fontFamily,
    fontSize: d.fontSize,
    color: d.color,
    textAlign: d.textAlign as any,
  });

  return (
    <div
      style={{ backgroundColor: main, color: textColor }}
      className="rounded-lg overflow-hidden border border-[var(--rule)] relative"
    >
      {/* Background image overlay */}
      {backgroundImageUrl && (
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            backgroundImage: `url(${backgroundImageUrl}?v=${bgKey})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />
      )}
      {/* Hero */}
      <div className="py-10 px-6 text-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-14 w-14 rounded-full mx-auto mb-4 object-cover shadow"
          />
        ) : (
          <div
            className="h-14 w-14 rounded-full bg-orange-500 mx-auto mb-4 flex items-center justify-center text-black font-bold text-xl"
          >
            {(orgName || "T")[0].toUpperCase()}
          </div>
        )}
        <h1 style={style(settings.name_design)}>{orgName || "Restaurant Name"}</h1>
        {text.tagline && (
          <p style={style(settings.tagline_design)} className="italic mt-2">
            {text.tagline}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <span className="px-4 py-2 rounded-full text-xs font-medium" style={{ backgroundColor: accent, color: main }}>
            View Menu
          </span>
          <span className="px-4 py-2 rounded-full text-xs font-medium border" style={{ borderColor: accent, color: accent }}>
            Book a Table
          </span>
        </div>
      </div>

      {/* About */}
      <section className="py-8 px-6" style={{ backgroundColor: main + "dd" }}>
        {photoUrls.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto items-start">
            <div className="text-left">
              <h2 style={style(settings.about_title_design)} className="text-left">{text.about_title || "About Us"}</h2>
              <p style={style(settings.about_content_design)} className="text-left mt-2">
                {text.about_text || "We serve fresh, handmade pasta with locally sourced ingredients. Family recipe passed down through three generations."}
              </p>
            </div>
            {/* Placeholder for restaurant photos */}
            <div className="rounded-xl bg-[var(--rule)] border-2 border-dashed flex items-center justify-center min-h-40">
              <span className="text-xs text-[var(--ink-soft)] uppercase tracking-wider">Restaurant photos</span>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto text-center">
            <h2 style={style(settings.about_title_design)}>{text.about_title || "About Us"}</h2>
            <p style={style(settings.about_content_design)} className="mt-2">
              {text.about_text || "We serve fresh, handmade pasta with locally sourced ingredients. Family recipe passed down through three generations."}
            </p>
          </div>
        )}
      </section>

      {/* Paragraphs */}
      {paragraphs.length > 0 && (
        <div className="space-y-4 py-6 px-6" style={{ backgroundColor: main + "bb" }}>
          {paragraphs.map((para) => {
            const td = para.title_design ?? { fontFamily: "'Inter', sans-serif", fontSize: 24, color: textColor, textAlign: "left" as const };
            const cd = para.content_design ?? { fontFamily: "'Inter', sans-serif", fontSize: 16, color: textColor, textAlign: "left" as const };
            return (
              <div key={para.id} className="grid md:grid-cols-2 gap-6">
                <div>
                  {para.title && (
                    <h3 style={{ fontFamily: td.fontFamily, fontSize: td.fontSize, color: td.color, textAlign: td.textAlign as any }} className="mb-2">
                      {para.title}
                    </h3>
                  )}
                  {para.content && (
                    <p style={{ fontFamily: cd.fontFamily, fontSize: cd.fontSize, color: cd.color, textAlign: cd.textAlign as any }} className="leading-relaxed whitespace-pre-line text-sm">
                      {para.content}
                    </p>
                  )}
                </div>
                {/* Placeholder for paragraph image */}
                <div className="rounded-xl bg-[var(--rule)] border-2 border-dashed flex items-center justify-center min-h-32">
                  <span className="text-xs text-[var(--ink-soft)] uppercase tracking-wider">Paragraph photo</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Location & Contact */}
      <section className="py-8 px-6" style={{ backgroundColor: main + "ee" }}>
        <div className="max-w-lg mx-auto">
          <h2 style={style(settings.contact_heading_design)}>{text.contact_heading || "Location & Contact"}</h2>
          <div className="grid md:grid-cols-2 gap-6 mt-4 text-sm" style={style(settings.contact_body_design)}>
            {/* Left: Location */}
            <div>
              {text.location && text.location.split("\n").filter(Boolean).map((loc, i) => (
                <p key={i} className="flex items-start gap-2 mb-1">
                  <span style={{ color: accent }}>•</span>
                  <span>{loc}</span>
                </p>
              ))}
              {(!text.location || !text.location.trim()) && <p className="text-[var(--ink-soft)]">No locations added.</p>}
            </div>
            {/* Right: Contact */}
            <div>
              {text.contact_phone && <p>📞 {text.contact_phone}</p>}
              {text.contact_email && <p>✉️ {text.contact_email}</p>}
              {text.contact_address && <p>📍 {text.contact_address}</p>}
              {(!text.contact_phone && !text.contact_email && !text.contact_address) && (
                <p className="text-[var(--ink-soft)]">No contact info added.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DesignPanel({
  orgId,
  orgName,
  paragraphs: initialParagraphs,
}: {
  orgId: string;
  orgName: string;
  paragraphs: ParagraphRow[];
}) {
  const supabase = createClient();
  const [settings, setSettings] = useState<DesignSettings>(DEFAULT_SETTINGS);
  const [paragraphs, setParagraphs] = useState<ParagraphRow[]>(initialParagraphs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState(orgName || "");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [bgKey, setBgKey] = useState(0);
  const [textData, setTextData] = useState({
    tagline: "",
    about_title: "About Us",
    about_text: "",
    contact_heading: "Location & Contact",
    location: "",
    contact_phone: "",
    contact_email: "",
    contact_address: "",
  });

  // Load org data
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("organizations")
        .select("logo_url, design_settings, restaurant_photos, background_image_url, branches, tagline, about_title, about_text, contact_heading, location, contact_phone, contact_email, contact_address")
        .eq("id", orgId)
        .single();
      if (data) {
        setLogoUrl(data.logo_url ?? null);
        setBackgroundImageUrl(data.background_image_url ?? null);
        setPhotoUrls((data.restaurant_photos as string[]) ?? []);
        if (data.design_settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.design_settings });
        }
        setTextData({
          tagline: data.tagline ?? "",
          about_title: data.about_title ?? "About Us",
          about_text: data.about_text ?? "",
          contact_heading: data.contact_heading ?? "Location & Contact",
          location: data.location ?? (data.branches && (data.branches as string[]).length > 0 ? (data.branches as string[]).join("\n") : ""),
          contact_phone: data.contact_phone ?? "",
          contact_email: data.contact_email ?? "",
          contact_address: data.contact_address ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, [orgId, supabase]);

  // Inject Google Fonts stylesheet so preview actually renders chosen fonts
  useEffect(() => {
    const existing = document.getElementById("tc-google-fonts");
    if (!existing) {
      const link = document.createElement("link");
      link.id = "tc-google-fonts";
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_CSS;
      document.head.appendChild(link);
    }
  }, []);

  const saveText = async () => {
    await fetch("/api/design/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, text: textData }),
    });
  };

  const save = async () => {
    await saveText();
    await persistPhotoOrder();
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/design/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, design_settings: settings }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveMsg("✓ Saved");
    } catch {
      setSaveMsg("✗ Save failed");
    }
    setSaving(false);
  };

  const saveName = async (name: string) => {
    setRestaurantName(name);
    await fetch("/api/design/name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, name }),
    });
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch("/api/design/logo", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      setLogoUrl(data.url);
    }
  };

  const uploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch("/api/design/background-image", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      setBackgroundImageUrl(data.url);
      setBgKey((k) => k + 1);
    }
  };

  const removeBackground = async () => {
    await fetch("/api/design/background-image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    });
    setBackgroundImageUrl(null);
    setBgKey((k) => k + 1);
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("org_id", orgId);
      const res = await fetch("/api/design/photos/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setPhotoUrls((prev) => [...prev, data.url]);
      }
    }
  };

  const movePhoto = (from: number, to: number) => {
    setPhotoUrls((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const deletePhoto = async (index: number) => {
    const url = photoUrls[index];
    if (url) {
      try {
        const path = new URL(url).pathname.slice(1);
        await supabase.storage.from("org-restaurant-images").remove([path]);
      } catch { /* ignore */ }
    }
    const next = photoUrls.filter((_, i) => i !== index);
    setPhotoUrls(next);
  };

  const persistPhotoOrder = async () => {
    await fetch("/api/design/photos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId, photos: photoUrls }),
    });
  };

  const addParagraph = async () => {
    if (paragraphs.length >= 5) return;
    const res = await fetch("/api/design/paragraphs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setParagraphs((prev) => [...prev, data.paragraph]);
    }
  };

  // Debounced ref for content saves — prevents re-render flash while typing
  const contentTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const updateParagraph = async (id: string, patch: Partial<ParagraphRow>) => {
    await fetch(`/api/design/paragraphs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  // Debounced content update — saves immediately to state for preview, flushes to API after 300ms
  const updateContentDebounced = (id: string, content: string) => {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, content } : p)),
    );
    clearTimeout(contentTimeoutRef.current[id]);
    contentTimeoutRef.current[id] = setTimeout(async () => {
      await fetch(`/api/design/paragraphs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    }, 300);
  };

  const deleteParagraph = async (id: string, position: number) => {
    await fetch(`/api/design/paragraphs/${id}`, { method: "DELETE" });
    const remaining = paragraphs.filter((p) => p.id !== id);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        await fetch(`/api/design/paragraphs/${remaining[i].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: i }),
        });
      }
    }
    setParagraphs(remaining);
  };

  const moveParagraph = async (from: number, to: number) => {
    const res = await fetch("/api/design/paragraphs/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        old_index: from,
        new_index: to,
      }),
    });
    if (res.ok) {
      setParagraphs((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    }
  };

  const uploadParagraphImage = async (
    paraId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("org_id", orgId);
    const res = await fetch("/api/design/paragraphs/image", {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      await updateParagraph(paraId, { image_url: data.url });
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-[var(--ink-soft)]">Loading designer…</div>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="space-y-8">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Controls
        </h2>

        {/* Theme Colors */}
        <section className="ticket p-5 space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Theme Colors
          </h3>
          <ColorField
            label="Background"
            value={settings.background_color}
            onChange={(v) => setSettings((s) => ({ ...s, background_color: v }))}
          />
          <ColorField
            label="Text"
            value={settings.text_color}
            onChange={(v) => setSettings((s) => ({ ...s, text_color: v }))}
          />
          <ColorField
            label="Accent"
            value={settings.accent_color}
            onChange={(v) => setSettings((s) => ({ ...s, accent_color: v }))}
          />
        </section>

        {/* Logo */}
        <section className="ticket p-5 space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Logo
          </h3>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold">
                {(restaurantName || "T")[0]}
              </div>
            )}
            <label className="btn btn-primary text-xs cursor-pointer">
              Upload Logo
              <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
            </label>
          </div>
        </section>

        {/* Text */}
        <section className="ticket p-5 space-y-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Text
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Restaurant Name
              </label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => saveName(e.target.value)}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Tagline
              </label>
              <input
                type="text"
                value={textData.tagline}
                onChange={(e) => setTextData((d) => ({ ...d, tagline: e.target.value }))}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                About Title
              </label>
              <input
                type="text"
                value={textData.about_title}
                onChange={(e) => setTextData((d) => ({ ...d, about_title: e.target.value }))}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                About Content
              </label>
              <textarea
                value={textData.about_text}
                onChange={(e) => setTextData((d) => ({ ...d, about_text: e.target.value }))}
                rows={3}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Contact Heading
              </label>
              <input
                type="text"
                value={textData.contact_heading}
                onChange={(e) => setTextData((d) => ({ ...d, contact_heading: e.target.value }))}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Location
              </label>
              <textarea
                value={textData.location}
                onChange={(e) => setTextData((d) => ({ ...d, location: e.target.value }))}
                rows={3}
                placeholder="One location per line, e.g.&#10;123 Food Street, Melbourne&#10;456 Coffee Lane, Sydney"
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={textData.contact_phone}
                onChange={(e) => setTextData((d) => ({ ...d, contact_phone: e.target.value }))}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Contact Email
              </label>
              <input
                type="text"
                value={textData.contact_email}
                onChange={(e) => setTextData((d) => ({ ...d, contact_email: e.target.value }))}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                Contact Address
              </label>
              <input
                type="text"
                value={textData.contact_address}
                onChange={(e) => setTextData((d) => ({ ...d, contact_address: e.target.value }))}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Text Styling */}
        <section className="ticket p-5 space-y-5">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Text Styling
          </h3>
          <DesignField
            label="Restaurant Name"
            design={settings.name_design}
            onChange={(d) => setSettings((s) => ({ ...s, name_design: d }))}
          />
          <DesignField
            label="Tagline"
            design={settings.tagline_design}
            onChange={(d) => setSettings((s) => ({ ...s, tagline_design: d }))}
          />
          <DesignField
            label="About Title"
            design={settings.about_title_design}
            onChange={(d) => setSettings((s) => ({ ...s, about_title_design: d }))}
          />
          <DesignField
            label="About Content"
            design={settings.about_content_design}
            onChange={(d) => setSettings((s) => ({ ...s, about_content_design: d }))}
          />
          <DesignField
            label="Contact Heading"
            design={settings.contact_heading_design}
            onChange={(d) => setSettings((s) => ({ ...s, contact_heading_design: d }))}
          />
          <DesignField
            label="Contact Body"
            design={settings.contact_body_design}
            onChange={(d) => setSettings((s) => ({ ...s, contact_body_design: d }))}
          />
        </section>

        {/* Restaurant Photos */}
        <section className="ticket p-5 space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Restaurant Photos
          </h3>
          <label className="btn btn-outline text-xs cursor-pointer inline-block">
            Add Photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={uploadPhoto}
            />
          </label>
          <div className="flex flex-wrap gap-3 mt-3">
            {photoUrls.map((url, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 object-cover rounded border border-[var(--rule)]"
                />
                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i - 1)}
                      className="bg-[var(--accent)] text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shadow"
                      title="Move up"
                    >
                      ↑
                    </button>
                  )}
                  {i < photoUrls.length - 1 && (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i + 1)}
                      className="bg-[var(--accent)] text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shadow"
                      title="Move down"
                    >
                      ↓
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deletePhoto(i)}
                    className="bg-red-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shadow"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={persistPhotoOrder}
            className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] underline"
          >
            Save photo order
          </button>
        </section>

        {/* Paragraphs */}
        <section className="ticket p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
              Paragraphs
            </h3>
            <span className="text-xs text-[var(--ink-soft)]">
              {paragraphs.length}/5
            </span>
          </div>
          {paragraphs.map((para, i) => (
            <div key={para.id} className="border border-[var(--rule)] rounded p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--ink-soft)]">
                  Paragraph {i + 1}
                </span>
                <div className="flex gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => moveParagraph(i, i - 1)}
                      className="text-xs px-2 py-1 border border-[var(--rule)] rounded hover:bg-[var(--paper-inverted)]"
                      title="Move up"
                    >
                      ↑
                    </button>
                  )}
                  {i < paragraphs.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveParagraph(i, i + 1)}
                      className="text-xs px-2 py-1 border border-[var(--rule)] rounded hover:bg-[var(--paper-inverted)]"
                      title="Move down"
                    >
                      ↓
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteParagraph(para.id, i)}
                    className="text-xs px-2 py-1 border border-red-300 text-red-500 rounded hover:bg-red-50"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Image position toggle */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-[var(--ink-soft)]">Layout:</label>
                <button
                  type="button"
                  onClick={() =>
                    updateParagraph(para.id, {
                      image_position:
                        para.image_position === "text-left" ? "text-right" : "text-left",
                    })
                  }
                  className="text-xs px-3 py-1 border border-[var(--rule)] rounded hover:bg-[var(--paper-inverted)]"
                >
                  {para.image_position === "text-left"
                    ? "Text left · Image right"
                    : "Image left · Text right"}
                </button>
              </div>

              {/* Title design */}
              <div>
                <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                  Title Design
                </label>
                <DesignField
                  design={para.title_design ?? DEFAULT_TEXT_DESIGN}
                  onChange={(d) => updateParagraph(para.id, { title_design: d })}
                  label=""
                />
              </div>

              {/* Title input */}
              <div>
                <input
                  type="text"
                  placeholder="Paragraph title"
                  value={para.title ?? ""}
                  onChange={(e) => updateParagraph(para.id, { title: e.target.value })}
                  className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Content design */}
              <div>
                <label className="block text-xs font-mono text-[var(--ink-soft)] mb-1">
                  Content Design
                </label>
                <DesignField
                  design={para.content_design ?? DEFAULT_TEXT_DESIGN}
                  onChange={(d) => updateParagraph(para.id, { content_design: d })}
                  label=""
                />
              </div>

              {/* Content textarea — debounced save, immediate visual update */}
              <textarea
                placeholder="Paragraph content…"
                value={para.content ?? ""}
                onChange={(e) => updateContentDebounced(para.id, e.target.value)}
                rows={3}
                className="w-full bg-[var(--paper-inverted)] border border-[var(--rule)] rounded px-3 py-2 text-sm resize-y"
              />

              {/* Image upload */}
              <div className="flex items-center gap-3">
                <label className="btn btn-outline text-xs cursor-pointer">
                  Attach Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadParagraphImage(para.id, e)}
                  />
                </label>
                {para.image_url && (
                  <span className="text-xs text-[var(--ink-soft)]">
                    ✓ Image attached
                  </span>
                )}
              </div>
            </div>
          ))}

          {paragraphs.length < 5 && (
            <button
              type="button"
              onClick={addParagraph}
              className="btn btn-outline text-sm w-full"
            >
              + Add Paragraph
            </button>
          )}
        </section>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn btn-primary px-8"
          >
            {saving ? "Saving…" : "Save All Changes"}
          </button>
          {saveMsg && <span className="text-sm text-[var(--ink-soft)]">{saveMsg}</span>}
        </div>
      </div>

      {/* ── Live Preview ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Live Preview
        </h2>
        <PreviewSection settings={settings} orgName={restaurantName} text={textData} paragraphs={paragraphs} photoUrls={photoUrls} backgroundImageUrl={backgroundImageUrl} logoUrl={logoUrl} bgKey={bgKey} />
        <p className="text-xs text-[var(--ink-soft)] text-center">
          Preview reflects text/design changes in real time. Click &quot;Save All Changes&quot; to persist.
        </p>

        {/* Background Image */}
        <section className="ticket p-5 space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">
            Background Image
          </h3>
          <p className="text-xs text-[var(--ink-soft)]">
            Upload an image to replace the background color. Overrides the solid color on the public page.
          </p>
          <label className="btn btn-outline text-xs cursor-pointer inline-block">
            {backgroundImageUrl ? "Replace Background" : "Upload Background"}
            <input
              key={bgKey}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadBackground}
            />
          </label>
          {backgroundImageUrl && (
            <>
              <button
                type="button"
                onClick={removeBackground}
                className="text-xs text-red-500 hover:text-red-600 underline"
              >
                Remove background image
              </button>
              <img src={`${backgroundImageUrl}?v=${bgKey}`} alt="Background" className="h-16 w-full object-cover rounded border border-[var(--rule)]" />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
