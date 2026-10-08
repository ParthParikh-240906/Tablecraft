"use client";

import { useMemo, useState } from "react";
import { useDesign } from "../use-design";
import { DesignNav } from "../design-nav";
import { EditableCard, EditableGrid } from "../editable-card";
import { PreviewShell } from "../preview-shell";
import { DesignDeviceProvider } from "../design-device";
import { SITE_THEMES, applySiteTheme } from "@/lib/site-themes";
import { type OrgView } from "@/components/OrgPageView";
import { type DesignSettingsV2 } from "@/lib/design";

export function ThemesPanel({
  orgId,
  orgName,
  orgSlug,
  initialSettings,
  orgContent,
  paragraphs,
}: {
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  initialSettings: DesignSettingsV2;
  orgContent: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
}) {
  const { settings, updateSettings, saving, saved, saveError, retrySave } = useDesign(initialSettings, orgId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // In-memory only until "Apply theme" is pressed — `settings` is untouched.
  // The preview recolors the site's CURRENT content (nothing is rebuilt).
  const previewSettings: DesignSettingsV2 = useMemo(() => {
    if (!previewId) return settings;
    return applySiteTheme(settings, previewId);
  }, [previewId, settings]);

  const previewTheme = previewId
    ? SITE_THEMES.find((t) => t.id === previewId) ?? null
    : null;
  const activeTheme = activeId
    ? SITE_THEMES.find((t) => t.id === activeId) ?? null
    : null;

  const hasCustomElements =
    settings.hero.elements.length > 0 || settings.content.elements.length > 0;

  const handleApply = (id: string, name: string) => {
    if (hasCustomElements) {
      const ok = confirm(
        `Apply ${name} colors to your current design? Your text, photos, and layout stay exactly as they are — only colors and fonts change. This can be undone.`,
      );
      if (!ok) return;
    }
    const applied = applySiteTheme(settings, id);
    updateSettings(applied);
    setActiveId(id);
    setPreviewId(null);
  };

  return (
    <DesignDeviceProvider>
    <div>
      <DesignNav />
      <div className="space-y-8">
        {/* ── Status ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-[var(--ink-soft)]">
            {activeTheme
              ? `Active theme: ${activeTheme.name} — press Undo in the toolbar above to revert.`
              : "No theme applied yet — preview one below, then apply it to the whole site."}
          </p>
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

        {/* ── Theme cards ────────────────────────────────────── */}
        <EditableGrid>
          {SITE_THEMES.map((t) => {
            const isPreviewing = previewId === t.id;
            const isActive = activeId === t.id;
            return (
              <EditableCard key={t.id} title={t.name}>
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-1">
                    {isActive && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent)] text-white">
                        Active
                      </span>
                    )}
                    {isPreviewing && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[var(--rule)] text-[var(--ink-soft)]">
                        Previewing
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-soft)] leading-relaxed min-h-12">
                  {t.blurb}
                </p>
                <div className="flex items-center gap-1.5" aria-label={`${t.name} palette`}>
                  {t.swatches.map((s) => (
                    <span
                      key={s}
                      className="w-5 h-5 rounded-full border border-[var(--rule)]"
                      style={{ backgroundColor: s }}
                      title={s}
                    />
                  ))}
                </div>
                {/* Mini palette preview */}
                <div className="rounded overflow-hidden border border-[var(--rule)]">
                  <div
                    className="flex items-center gap-1 px-2 py-1.5"
                    style={{ backgroundColor: t.swatches[0] }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: t.swatches[1] }}
                    />
                    <span
                      className="h-1.5 w-10 rounded-full opacity-70"
                      style={{ backgroundColor: t.swatches[1] }}
                    />
                    <span className="ml-auto flex gap-1">
                      <span
                        className="h-1.5 w-5 rounded-full opacity-70"
                        style={{ backgroundColor: t.swatches[1] }}
                      />
                      <span
                        className="h-3 w-8 rounded-full"
                        style={{ backgroundColor: t.swatches[2] }}
                      />
                    </span>
                  </div>
                  <div
                    className="px-2 py-2.5 space-y-1.5"
                    style={{ backgroundColor: t.swatches[0] }}
                  >
                    <div
                      className="h-2 w-3/4 rounded-full"
                      style={{ backgroundColor: t.swatches[1] }}
                    />
                    <div
                      className="h-2 w-1/2 rounded-full opacity-70"
                      style={{ backgroundColor: t.swatches[1] }}
                    />
                    <div
                      className="h-4 w-16 rounded-full mt-1"
                      style={{ backgroundColor: t.swatches[2] }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewId(isPreviewing ? null : t.id)}
                    className="btn btn-outline text-xs flex-1"
                  >
                    {isPreviewing ? "Close preview" : "Preview"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApply(t.id, t.name)}
                    className="btn btn-accent text-xs flex-1"
                  >
                    Apply theme
                  </button>
                </div>
              </EditableCard>
            );
          })}
        </EditableGrid>

        {/* ── Preview ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
              {previewTheme ? `Previewing: ${previewTheme.name}` : "Live Preview"}
            </h2>
            {orgSlug && (
              <a
                href={`/${orgSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--ink-soft)] underline"
              >
                View live site →
              </a>
            )}
          </div>
          {previewTheme && (
            <p className="text-xs text-[var(--ink-soft)]">
              This is an in-memory preview — nothing is saved until you press
              “Apply theme”.
            </p>
          )}
          <PreviewShell
            settings={previewSettings}
            org={orgContent}
            paragraphs={paragraphs}
            colors={{
              bg: previewSettings.background_color,
              text: previewSettings.text_color,
              accent: previewSettings.accent_color,
            }}
            orgName={orgName}
          />
        </div>
      </div>
    </div>
    </DesignDeviceProvider>
  );
}
