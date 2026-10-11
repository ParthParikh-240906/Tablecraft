"use client";

import { resolveFontSize, type DesignSettingsV2 } from "@/lib/design";
import { useDesignDevice } from "../design-device";

/**
 * Non-interactive chatbot preview for the Website tab.
 * Mirrors components/BookingChatbot styling (launcher button + open panel)
 * so prompt-driven chatbot changes are visible without manual controls.
 */
export function ChatbotPreview({
  settings,
  orgName,
}: {
  settings: DesignSettingsV2;
  orgName: string;
}) {
  const { device } = useDesignDevice();
  const chatbot = settings.chatbot;
  const color = chatbot?.color ?? settings.accent_color;
  const logo = chatbot?.logo_url ?? null;
  const textColor = chatbot?.text_color ?? "#ffffff";
  const textSize = resolveFontSize(chatbot?.text_size ?? 14, "chatbot.text", device, settings.responsive);
  const fontFamily = chatbot?.font_family ?? "Inter";
  const borderColor = chatbot?.border_color ?? "transparent";
  const borderWidth = chatbot?.border_width ?? 0;

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--rule)] bg-[var(--paper-raised)]">
      <div className="px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] border-b border-[var(--rule)]">
        Chatbot preview <span className="text-[var(--ink-faint)]">· non-interactive</span>
      </div>
      <div className="p-4 flex flex-wrap gap-4 items-start">
        {/* Closed state: launcher button bottom-right on a neutral stage */}
        <div className="flex-1 min-w-52">
          <p className="text-xs text-[var(--ink-soft)] mb-2">Button (closed)</p>
          <div className="relative h-36 rounded border border-[var(--rule)] bg-[var(--paper)]">
            <div
              className="absolute bottom-3 right-3 h-14 w-14 rounded-full flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: color,
                ...(borderWidth > 0 ? { border: `${borderWidth}px solid ${borderColor}` } : {}),
              }}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Chatbot logo" className="h-full w-full rounded-full object-cover" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="6" r="3" />
                  <line x1="12" y1="9" x2="12" y2="11" />
                  <line x1="8" y1="14" x2="8" y2="17" />
                  <line x1="16" y1="14" x2="16" y2="17" />
                  <line x1="10" y1="15" x2="10" y2="16" />
                  <line x1="14" y1="15" x2="14" y2="16" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Open state: chat window mock */}
        <div className="flex-1 min-w-52">
          <p className="text-xs text-[var(--ink-soft)] mb-2">Chat window (open)</p>
          <div
            className="flex flex-col shadow-2xl rounded-2xl overflow-hidden border max-w-80"
            style={{ backgroundColor: "var(--paper-raised)", borderColor: "var(--rule)" }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2"
              style={{ backgroundColor: color }}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span
                  className="h-6 w-6 rounded-full inline-block"
                  style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                />
              )}
              <span
                className="text-sm font-semibold truncate"
                style={{ color: textColor, fontFamily, fontSize: textSize }}
              >
                {orgName}
              </span>
            </div>
            <div className="p-3 space-y-2">
              <div
                className="rounded-xl px-3 py-2 max-w-[85%]"
                style={{ backgroundColor: color, color: textColor, fontFamily, fontSize: textSize }}
              >
                Hi! How many guests should I book for?
              </div>
              <div
                className="rounded-xl px-3 py-2 max-w-[85%] ml-auto"
                style={{ backgroundColor: "var(--paper-overlay)", color: "var(--ink)", fontFamily, fontSize: textSize }}
              >
                4 guests, tomorrow at 7pm
              </div>
            </div>
            <div className="px-3 py-2 border-t flex gap-2 items-center" style={{ borderColor: "var(--rule)" }}>
              <div
                className="flex-1 text-sm px-3 py-2 rounded-lg border"
                style={{ borderColor: "var(--rule)", backgroundColor: "var(--paper)", color: "var(--ink-faint)", fontFamily, fontSize: textSize }}
              >
                Type your message...
              </div>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: color }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Spec: exact colors + text theme */}
        <div className="min-w-52">
          <p className="text-xs text-[var(--ink-soft)] mb-2">Chat text theme</p>
          <ul className="text-xs space-y-1.5 text-[var(--ink-soft)]">
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border border-[var(--rule)] inline-block" style={{ backgroundColor: color }} />
              Button <span className="font-mono text-[var(--ink)]">{color}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border border-[var(--rule)] inline-block" style={{ backgroundColor: textColor }} />
              Text <span className="font-mono text-[var(--ink)]">{textColor}</span>
            </li>
            <li>
              Font <span className="text-[var(--ink)]" style={{ fontFamily }}>{fontFamily}</span>
              <span className="text-[var(--ink-faint)]"> · {textSize}px{device !== "desktop" ? ` · ${device}` : ""}</span>
            </li>
            <li>
              Border <span className="font-mono text-[var(--ink)]">{borderWidth > 0 ? `${borderWidth}px ${borderColor}` : "none"}</span>
            </li>
            <li>
              Logo <span className="text-[var(--ink)]">{logo ? "custom" : "default bot icon"}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
