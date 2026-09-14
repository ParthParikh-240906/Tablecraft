"use client";

import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { ColorField, DesignField } from "../design-fields";
import { SiteHeader } from "@/components/SiteHeader";
import { defaultMenuPageDesign, type DesignSettingsV2, type MenuPageDesign } from "@/lib/design";
import { ShapeStyle, type ContentElement } from "@/lib/design";

interface ShapeElement {
  id: string;
  style: ShapeStyle;
}

export function MenuPagePanel({
  orgId,
  orgName,
  initialSettings,
}: {
  orgId: string;
  orgName: string;
  initialSettings: DesignSettingsV2;
}) {
  const { settings, updateSettings, saving, saved } = useDesign(initialSettings, orgId);
  const menu: MenuPageDesign = settings.menu_page ?? defaultMenuPageDesign();
  const colors = {
    bg: settings.background_color,
    text: settings.text_color,
    accent: settings.accent_color,
  };

  const update = (patch: Partial<MenuPageDesign>) => {
    updateSettings({ menu_page: { ...menu, ...patch } } as Partial<DesignSettingsV2>);
  };

  const updateShape = (id: string, patch: Partial<ShapeStyle>) => {
    const shapes = (settings.menu_page_shapes as ShapeElement[] | undefined) ?? [];
    updateSettings({
      menu_page_shapes: shapes.map((s) => (s.id === id ? { ...s, style: { ...s.style, ...patch } } : s)),
    } as Partial<DesignSettingsV2>);
  };

  const addShape = () => {
    const shapes = (settings.menu_page_shapes as ShapeElement[] | undefined) ?? [];
    const newShape: ShapeElement = {
      id: Math.random().toString(36).slice(2, 10),
      style: { color: "#1a1a1a", borderWidth: 0, borderColor: undefined, borderRadius: 0, opacity: 80 },
    };
    updateSettings({ menu_page_shapes: [...shapes, newShape] } as Partial<DesignSettingsV2>);
  };

  const removeShape = (id: string) => {
    const shapes = (settings.menu_page_shapes as ShapeElement[] | undefined) ?? [];
    updateSettings({ menu_page_shapes: shapes.filter((s) => s.id !== id) } as Partial<DesignSettingsV2>);
  };

  const orgView = {
    name: orgName,
    tagline: null,
    logo_url: null,
    about_title: null,
    about_text: null,
    contact_heading: null,
    location: null,
    contact_phone: null,
    contact_email: null,
    contact_address: null,
    restaurant_photos: [],
  };

  const shapes = (settings.menu_page_shapes as ShapeElement[] | undefined) ?? [];
  const previewScale = 0.85;

  const text = (d: { fontFamily: string; fontSize: number; color: string; textAlign: string }, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: d.fontFamily,
    fontSize: `${d.fontSize * previewScale}px`,
    color: d.color,
    textAlign: d.textAlign as React.CSSProperties["textAlign"],
    ...extra,
  });

  return (
    <div>
      <DesignNav />
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Menu Page</h2>
            <span className="text-xs text-[var(--ink-faint)]">
              {saving ? "Saving…" : saved ? "✓ Saved" : ""}
            </span>
          </div>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Page Title ("Menu")</h3>
            <ColorField label="Color" value={menu.title_design.color} onChange={(v) => update({ title_design: { ...menu.title_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {menu.title_design.fontSize}px</label>
              <input type="range" min={12} max={72} value={menu.title_design.fontSize}
                onChange={(e) => update({ title_design: { ...menu.title_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={menu.title_design} onChange={(d) => update({ title_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Subtitle</h3>
            <ColorField label="Color" value={menu.subtitle_design.color} onChange={(v) => update({ subtitle_design: { ...menu.subtitle_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {menu.subtitle_design.fontSize}px</label>
              <input type="range" min={10} max={40} value={menu.subtitle_design.fontSize}
                onChange={(e) => update({ subtitle_design: { ...menu.subtitle_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={menu.subtitle_design} onChange={(d) => update({ subtitle_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Category Heading</h3>
            <ColorField label="Color" value={menu.category_design.color} onChange={(v) => update({ category_design: { ...menu.category_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {menu.category_design.fontSize}px</label>
              <input type="range" min={10} max={40} value={menu.category_design.fontSize}
                onChange={(e) => update({ category_design: { ...menu.category_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={menu.category_design} onChange={(d) => update({ category_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Item Name</h3>
            <ColorField label="Color" value={menu.item_name_design.color} onChange={(v) => update({ item_name_design: { ...menu.item_name_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {menu.item_name_design.fontSize}px</label>
              <input type="range" min={10} max={40} value={menu.item_name_design.fontSize}
                onChange={(e) => update({ item_name_design: { ...menu.item_name_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={menu.item_name_design} onChange={(d) => update({ item_name_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Item Price</h3>
            <ColorField label="Color" value={menu.item_price_design.color} onChange={(v) => update({ item_price_design: { ...menu.item_price_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {menu.item_price_design.fontSize}px</label>
              <input type="range" min={10} max={40} value={menu.item_price_design.fontSize}
                onChange={(e) => update({ item_price_design: { ...menu.item_price_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={menu.item_price_design} onChange={(d) => update({ item_price_design: d })} />
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Item Description</h3>
            <ColorField label="Color" value={menu.item_description_design.color} onChange={(v) => update({ item_description_design: { ...menu.item_description_design, color: v } })} />
            <div>
              <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Font size: {menu.item_description_design.fontSize}px</label>
              <input type="range" min={8} max={32} value={menu.item_description_design.fontSize}
                onChange={(e) => update({ item_description_design: { ...menu.item_description_design, fontSize: parseInt(e.target.value, 10) } })}
                className="w-full accent-[var(--accent)]" />
            </div>
            <DesignField label="" design={menu.item_description_design} onChange={(d) => update({ item_description_design: d })} />
          </section>

          {/* Shapes */}
          <section className="ticket p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Background Shapes</h3>
              <button type="button" onClick={addShape} className="btn btn-outline text-xs">+ Add Shape</button>
            </div>
            {shapes.length === 0 && (
              <p className="text-xs text-[var(--ink-faint)]">No shapes. Add one to create a layered background behind the menu.</p>
            )}
            {shapes.map((shape) => (
              <div key={shape.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[var(--ink-soft)]">Shape {shapes.indexOf(shape) + 1}</span>
                  <button type="button" onClick={() => removeShape(shape.id)} className="text-red-500 text-[10px] underline">Remove</button>
                </div>
                <ColorField label="Fill color" value={shape.style.color ?? "#1a1a1a"} onChange={(v) => updateShape(shape.id, { color: v })} />
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Opacity: {shape.style.opacity ?? 100}%</label>
                  <input type="range" min={0} max={100} value={shape.style.opacity ?? 100}
                    onChange={(e) => updateShape(shape.id, { opacity: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <ColorField label="Border color" value={shape.style.borderColor ?? "#ffffff"} onChange={(v) => updateShape(shape.id, { borderColor: v })} />
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Border width: {shape.style.borderWidth ?? 0}px</label>
                  <input type="range" min={0} max={12} value={shape.style.borderWidth ?? 0}
                    onChange={(e) => updateShape(shape.id, { borderWidth: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[var(--ink-soft)] mb-1">Roundness: {shape.style.borderRadius ?? 0}% (50 = circle)</label>
                  <input type="range" min={0} max={50} value={shape.style.borderRadius ?? 0}
                    onChange={(e) => updateShape(shape.id, { borderRadius: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* ── Live preview ─────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
          <div className="rounded-lg overflow-hidden border border-[var(--rule)] bg-[var(--paper-raised)]">
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)] border-b border-[var(--rule)]">
              <span>Menu page preview</span>
              <span>{orgName}</span>
            </div>
            <div
              className="h-[720px] overflow-y-auto relative"
              style={{ backgroundColor: colors.bg, color: colors.text, containerType: "inline-size" }}
            >
              <SiteHeader org={orgView} settings={settings} colors={colors} mode="preview" />
              <div className="max-w-3xl mx-auto px-4 py-10 relative">
                {/* Background shapes (rendered first = behind everything) */}
                {shapes.map((shape) => (
                  <div
                    key={shape.id}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundColor: shape.style.color,
                      opacity: (shape.style.opacity ?? 100) / 100,
                      border: shape.style.borderWidth
                        ? `${shape.style.borderWidth}px solid ${shape.style.borderColor ?? "#ffffff"}`
                        : undefined,
                      borderRadius: shape.style.borderRadius ? `${shape.style.borderRadius}%` : undefined,
                    }}
                  />
                ))}

                <h1 style={text(menu.title_design, { fontWeight: 700, position: "relative", zIndex: 1 })}>Menu</h1>
                <p style={text(menu.subtitle_design, { marginBottom: "2rem", position: "relative", zIndex: 1 })}>
                  Everything we're serving right now at {orgName}.
                </p>

                {/* Sample category + items */}
                <section className="mb-10" style={{ position: "relative", zIndex: 1 }}>
                  <h2 style={text(menu.category_design, { fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" })}>
                    Starters
                  </h2>
                  <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
                    {[
                      { name: "Samosa Chaat", desc: "Crisp pastry, chickpeas, tamarind, yogurt", price: "12.00" },
                      { name: "Paneer Tikka", desc: "Charred cottage cheese, mint chutney", price: "16.00" },
                      { name: "Onion Bhaji", desc: "Crispy fritters, raita", price: "10.00" },
                    ].map((item) => (
                      <li key={item.name} className="py-4 flex items-start justify-between gap-4">
                        <div>
                          <h3 style={text(menu.item_name_design, { fontWeight: 500 })}>{item.name}</h3>
                          <p style={text(menu.item_description_design, { marginTop: "0.25rem" })}>{item.desc}</p>
                        </div>
                        <span style={text(menu.item_price_design, { fontWeight: 600, whiteSpace: "nowrap" })}>
                          AED {item.price}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="mb-10" style={{ position: "relative", zIndex: 1 }}>
                  <h2 style={text(menu.category_design, { fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" })}>
                    Mains
                  </h2>
                  <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
                    {[
                      { name: "Butter Chicken", desc: "Slow-cooked tomato gravy, cream, naan", price: "24.00" },
                      { name: "Lamb Rogan Josh", desc: "Aromatic Kashmiri curry, basmati rice", price: "28.00" },
                    ].map((item) => (
                      <li key={item.name} className="py-4 flex items-start justify-between gap-4">
                        <div>
                          <h3 style={text(menu.item_name_design, { fontWeight: 500 })}>{item.name}</h3>
                          <p style={text(menu.item_description_design, { marginTop: "0.25rem" })}>{item.desc}</p>
                        </div>
                        <span style={text(menu.item_price_design, { fontWeight: 600, whiteSpace: "nowrap" })}>
                          AED {item.price}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}