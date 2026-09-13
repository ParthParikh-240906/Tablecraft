"use client";

import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { ColorField, DesignField } from "../design-fields";
import { SiteHeader } from "@/components/SiteHeader";
import { defaultMenuPageDesign, type DesignSettingsV2, type MenuPageDesign } from "@/lib/design";

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

  const text = (d: { fontFamily: string; fontSize: number; color: string; textAlign: string }, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: d.fontFamily,
    fontSize: `${d.fontSize}px`,
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
              <div className="max-w-3xl mx-auto px-4 py-10">
                <h1 style={text(menu.title_design, { fontWeight: 700 })}>Menu</h1>
                <p style={text(menu.subtitle_design, { marginBottom: "2rem" })}>
                  Everything we're serving right now at {orgName}.
                </p>

                {/* Sample category + items */}
                <section className="mb-10">
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

                <section className="mb-10">
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