"use client";

import { useEffect, type ReactNode } from "react";
import { GOOGLE_FONTS_CSS, type DesignSettingsV2 } from "@/lib/design";
import { OrgPageView, type OrgView } from "@/components/OrgPageView";

/**
 * Full-page scroll preview frame shared by all design subpages.
 * Renders the actual page via OrgPageView (identical to the public site) plus
 * the panel's interactive overlay boxes (children). Widths/heights/fonts are
 * container-relative, so the preview matches the site proportionally.
 */
export function PreviewShell({
  settings,
  org,
  paragraphs,
  colors,
  orgName,
  onGrowHero,
  onGrowContent,
  children,
  previewHeight = 640,
}: {
  settings: DesignSettingsV2;
  org: OrgView;
  paragraphs: { id: string; title: string | null; content: string | null }[];
  colors: { bg: string; text: string; accent: string };
  orgName: string;
  onGrowHero?: (id: string, h: number) => void;
  onGrowContent?: (id: string, h: number) => void;
  children?: ReactNode;
  previewHeight?: number;
}) {
  // Make the 10 Google Fonts available to the preview.
  useEffect(() => {
    if (document.getElementById("tc-designer-fonts")) return;
    const link = document.createElement("link");
    link.id = "tc-designer-fonts";
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_CSS;
    document.head.appendChild(link);
  }, []);

  const hClass = previewHeight === 640 ? "h-[640px]" : previewHeight === 960 ? "h-[960px]" : previewHeight === 1280 ? "h-[1280px]" : `h-[${previewHeight}px]`;

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--rule)] bg-[var(--paper-raised)]">
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--ink-faint)] border-b border-[var(--rule)]">
        <span>Storefront preview</span>
        <span>{orgName}</span>
      </div>
      <div
        className={`${hClass} overflow-y-auto relative scroll-smooth`}
        style={{ backgroundColor: settings.background_color, color: settings.text_color }}
      >
        <OrgPageView
          mode="preview"
          org={org}
          settings={settings}
          paragraphs={paragraphs}
          colors={colors}
          onGrowHero={onGrowHero}
          onGrowContent={onGrowContent}
        />
        {children}
      </div>
    </div>
  );
}