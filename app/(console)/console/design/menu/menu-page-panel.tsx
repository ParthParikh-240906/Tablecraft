"use client";

import { useEffect, useState } from "react";
import { useDesign } from "../use-design";
import { useDesignDevice } from "../design-device";
import { DesignNav } from "../design-nav";
import { ColorField, DesignField } from "../design-fields";
import { AnimationBuilder } from "@/components/AnimationBuilder";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";
import { defaultMenuPageDesign, getFontOverride, resolveFontSize, withFontOverride, type DesignSettingsV2, type MenuPageDesign, getShadowStyle } from "@/lib/design";

interface PreviewMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
}

function formatPrice(price: unknown): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return "AED —";
  return `AED ${n.toFixed(2)}`;
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
  const { settings, updateSettings, saving, saved, saveError, retrySave } = useDesign(initialSettings, orgId);
  const { device } = useDesignDevice();
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

  // Real-data preview: same query the public menu page uses (getMenuByOrg —
  // available items ordered by category/sort order), read with the same
  // browser client as the console menu manager. No new API route needed.
  const [menuItems, setMenuItems] = useState<PreviewMenuItem[] | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("menu_items")
      .select("id, name, description, price, category")
      .eq("org_id", orgId)
      .eq("available", true)
      .order("category_sort_order", { ascending: true })
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setMenuError(`Could not load live menu: ${error.message}`);
          setMenuItems([]);
        } else {
          setMenuError(null);
          setMenuItems((data ?? []) as PreviewMenuItem[]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Up to ~8 real items, grouped by their real categories (order preserved).
  const grouped: { category: string; items: PreviewMenuItem[] }[] = [];
  for (const item of (menuItems ?? []).slice(0, 8)) {
    const cat = item.category ?? "Other";
    const g = grouped.find((x) => x.category === cat);
    if (g) g.items.push(item);
    else grouped.push({ category: cat, items: [item] });
  }

  // NOTE: renders at 1:1 (no previewScale) to match the public menu page,
  // which uses raw fontSize px values (menu/page.tsx inline()). Sizes resolve
  // per-device overrides so the preview stays truthful on tablet/mobile.
  const text = (d: { fontFamily: string; fontSize: number; color: string; textAlign: string; shadow?: { color: string; direction: number; length: number; opacity?: number } }, fontKey: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: d.fontFamily,
    fontSize: `${resolveFontSize(d.fontSize, fontKey, device, settings.responsive)}px`,
    color: d.color,
    textAlign: d.textAlign as React.CSSProperties["textAlign"],
    textShadow: getShadowStyle(d.shadow),
    ...extra,
  });
  // Accent-gradient word treatment (shares OrgPageView's .gradient-text).
  const gcls = (d: { gradient?: boolean }): string | undefined =>
    d.gradient ? "gradient-text" : undefined;

  return (
    <div>
      <DesignNav />
      {/* STACKED layout: controls on top (full width), live preview below (full width). */}
      <div className="space-y-10">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Menu Page</h2>
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


          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Back Button ("Back to {orgName}")</h3>
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <ColorField label="Color" value={menu.back_button_color ?? "#ffffff"} onChange={(v) => update({ back_button_color: v })} bgColor={colors.bg} />
              </div>
            </details>
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Page Title ("Menu")</h3>
            {/* Standalone color + size controls removed as duplicates of DesignField below. */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <DesignField customFonts={settings.custom_fonts} label="" design={menu.title_design} onChange={(d) => update({ title_design: d })} fontKey="menu.title" overrideValue={getFontOverride(settings.responsive, device, "menu.title")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "menu.title", v) }))} />
                <AnimationBuilder design={menu.title_design} onChange={(d) => update({ title_design: d })} />
              </div>
            </details>
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Subtitle</h3>
            {/* Standalone color + size controls removed as duplicates of DesignField below. */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <DesignField customFonts={settings.custom_fonts} label="" design={menu.subtitle_design} onChange={(d) => update({ subtitle_design: d })} fontKey="menu.subtitle" overrideValue={getFontOverride(settings.responsive, device, "menu.subtitle")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "menu.subtitle", v) }))} />
                <AnimationBuilder design={menu.subtitle_design} onChange={(d) => update({ subtitle_design: d })} />
              </div>
            </details>
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Category Heading</h3>
            {/* Standalone color + size controls removed as duplicates of DesignField below. */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <DesignField customFonts={settings.custom_fonts} label="" design={menu.category_design} onChange={(d) => update({ category_design: d })} fontKey="menu.category" overrideValue={getFontOverride(settings.responsive, device, "menu.category")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "menu.category", v) }))} />
                <AnimationBuilder design={menu.category_design} onChange={(d) => update({ category_design: d })} />
              </div>
            </details>
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Item Name</h3>
            {/* Standalone color + size controls removed as duplicates of DesignField below. */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <DesignField customFonts={settings.custom_fonts} label="" design={menu.item_name_design} onChange={(d) => update({ item_name_design: d })} fontKey="menu.item_name" overrideValue={getFontOverride(settings.responsive, device, "menu.item_name")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "menu.item_name", v) }))} />
                <AnimationBuilder design={menu.item_name_design} onChange={(d) => update({ item_name_design: d })} />
              </div>
            </details>
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Item Price</h3>
            {/* Standalone color + size controls removed as duplicates of DesignField below. */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <DesignField customFonts={settings.custom_fonts} label="" design={menu.item_price_design} onChange={(d) => update({ item_price_design: d })} fontKey="menu.item_price" overrideValue={getFontOverride(settings.responsive, device, "menu.item_price")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "menu.item_price", v) }))} />
                <AnimationBuilder design={menu.item_price_design} onChange={(d) => update({ item_price_design: d })} />
              </div>
            </details>
          </section>

          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Item Description</h3>
            {/* Standalone color + size controls removed as duplicates of DesignField below. */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <DesignField customFonts={settings.custom_fonts} label="" design={menu.item_description_design} onChange={(d) => update({ item_description_design: d })} fontKey="menu.item_description" overrideValue={getFontOverride(settings.responsive, device, "menu.item_description")} onOverrideFontSize={(v) => updateSettings((prev) => ({ responsive: withFontOverride(prev.responsive, device, "menu.item_description", v) }))} />
                <AnimationBuilder design={menu.item_description_design} onChange={(d) => update({ item_description_design: d })} />
              </div>
            </details>
          </section>

          {/* Item box border */}
          <section className="ticket p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-[var(--ink)] mb-3">Menu Item Box Border</h3>
            <details className="group">
              <summary className="cursor-pointer text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"><span className="group-open:hidden">Show More</span><span className="hidden group-open:inline">Show Less</span></summary>
              <div className="pt-3 space-y-3">
                <ColorField label="Border color" value={menu.border_color} onChange={(v) => update({ border_color: v })} />
                <div>
                  <label className="block text-[10px] text-[var(--ink-soft)] mb-1">Border width: {menu.border_width}px</label>
                  <input type="range" min={0} max={8} value={menu.border_width}
                    onChange={(e) => update({ border_width: parseInt(e.target.value, 10) })}
                    className="w-full accent-[var(--accent)]" />
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={menu.hover_lift !== false}
                    onChange={(e) => update({ hover_lift: e.target.checked ? undefined : false })}
                    className="accent-[var(--accent)]"
                  />
                  Hover lift
                </label>
              </div>
            </details>
          </section>

          </div>
        </div>

        {/* ── Live preview (full width below) ──────────────────── */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Live Preview</h2>
          <div className="rounded-lg overflow-hidden border border-[var(--rule)] bg-[var(--paper-raised)]">
            <div className="flex items-center justify-between px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] border-b border-[var(--rule)]">
              <span>Menu page preview · live data</span>
              <span>{orgName}</span>
            </div>
            <div
              className="h-[720px] overflow-y-auto relative"
              style={{ backgroundColor: colors.bg, color: colors.text, containerType: "inline-size" }}
            >
              <SiteHeader org={orgView} settings={settings} colors={colors} mode="preview" device={device} />
              <div className="max-w-3xl mx-auto px-4 py-10">
                <div className="mb-6">
                  <span
                    className="inline-flex items-center gap-2 text-sm font-medium underline"
                    style={{ color: menu.back_button_color ?? "#ffffff" }}
                  >
                    <span aria-hidden="true">&larr;</span>
                    <span>Back to {orgName}</span>
                  </span>
                </div>
                <h1 className={gcls(menu.title_design)} style={text(menu.title_design, "menu.title", { fontWeight: 700 })}>Menu</h1>
                <p className={gcls(menu.subtitle_design)} style={text(menu.subtitle_design, "menu.subtitle", { marginBottom: "2rem" })}>
                  Everything we're serving right now at {orgName}.
                </p>

                {/* Live menu items (up to 8), grouped by real category */}
                {menuItems === null ? (
                  <p className="text-sm text-[var(--ink-faint)]">Loading live menu…</p>
                ) : grouped.length === 0 ? (
                  <div>
                    {menuError && (
                      <p className="text-xs text-amber-400 mb-3" role="status">{menuError}</p>
                    )}
                    <div className="rounded-2xl border border-dashed p-10 text-center">
                      <p className="font-medium">No menu items yet</p>
                      <p className="text-sm mt-1">Check back soon — we're updating our menu.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {menuError && (
                      <p className="text-xs text-amber-400" role="status">{menuError}</p>
                    )}
                    {grouped.map(({ category, items }) => (
                      <section
                        key={category}
                        className={`rounded-lg p-5${menu.hover_lift !== false ? " transition-all duration-200 hover:-translate-y-1 hover:shadow-xl" : ""}`}
                        style={{
                          backgroundColor: "#ffffff",
                          border: `${menu.border_width}px solid ${menu.border_color}`,
                        }}
                      >
                        <h2 className={gcls(menu.category_design)} style={text(menu.category_design, "menu.category", { fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" })}>
                          {category}
                        </h2>
                        <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
                          {items.map((item) => (
                            <li key={item.id} className="py-4 flex items-start justify-between gap-4">
                              <div>
                                <h3 className={gcls(menu.item_name_design)} style={text(menu.item_name_design, "menu.item_name", { fontWeight: 500 })}>{item.name}</h3>
                                {item.description && (
                                  <p className={gcls(menu.item_description_design)} style={text(menu.item_description_design, "menu.item_description", { marginTop: "0.25rem" })}>{item.description}</p>
                                )}
                              </div>
                              <span className={gcls(menu.item_price_design)} style={text(menu.item_price_design, "menu.item_price", { fontWeight: 600, whiteSpace: "nowrap" })}>
                                {formatPrice(item.price)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
