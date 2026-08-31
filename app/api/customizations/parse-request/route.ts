import { NextResponse } from "next/server";
import type { RestaurantSettings } from "@/types/customization";

/**
 * Parse a user's natural language request into structured settings.
 * 
 * This is a lightweight client-side parser for basic keyword matching.
 * Complex design requests (themes, aesthetics) are handled by the 
 * Kiro-frontend subagent when it processes the pending request.
 */

export async function POST(request: Request) {
  const { userRequestText, currentSettings } = await request.json();
  
  if (!userRequestText) {
    return NextResponse.json({ error: "Request text required" }, { status: 400 });
  }

  const lower = userRequestText.toLowerCase();
  const changes: Partial<RestaurantSettings> = {};
  let description = "Layout customization";

  // --- Layout Position Keywords ---
  if (/\b(left|sidebar\s*left)\b/.test(lower)) {
    changes.menuPosition = 'left';
    description = "Your menu will move to the left sidebar.";
  }
  if (/\b(right|sidebar\s*right)\b/.test(lower)) {
    changes.menuPosition = 'right';
    description = "Your menu will move to the right sidebar.";
  }
  if (/\b(top|horizontal|bar)\b/.test(lower)) {
    changes.menuPosition = 'top';
    description = "Your menu will become a horizontal bar at the top.";
  }

  // --- Booking Keywords ---
  if (/\b(popup|modal|dialog|overlay)\b/.test(lower)) {
    changes.bookingPosition = 'modal';
    description += " The booking form will appear as a popup modal.";
  }
  if (/\b(side\s*panel|slide\s*out|drawer)\b/.test(lower)) {
    changes.bookingPosition = 'sidebar';
    description += " The booking form will slide out from the side.";
  }
  if (/\b(inline|embedded|on\s*page)\b/.test(lower)) {
    changes.bookingPosition = 'inline';
    description += " The booking form will be embedded in the page.";
  }

  // --- Cart Keywords ---
  if (/\b(cart|basket).*(bottom|lower)\b/.test(lower)) {
    changes.cartPosition = 'bottom-right';
  }
  if (/\b(floating|draggable)\b/.test(lower)) {
    changes.cartPosition = 'floating-bottom';
  }

  // --- Color Keywords ---
  const colorMap: Record<string, string> = {
    'burgundy|wine|maroon': '#722F37',
    'ocean|blue|navy|deep blue': '#1e40af',
    'forest|green|emerald': '#166534',
    'gold|golden|amber': '#d4af37',
    'red|crimson|scarlet': '#dc2626',
    'purple|violet|royal purple': '#7c3aed',
    'orange|tangerine|coral': '#ea580c',
    'pink|rose|blush': '#e11d48',
    'teal|cyan|turquoise': '#0d9488',
    'black|dark|midnight|obsidian': '#1a1a1a',
    'white|light|bright|snow': '#ffffff',
  };

  for (const [pattern, hex] of Object.entries(colorMap)) {
    if (new RegExp(pattern, 'i').test(lower)) {
      changes.primaryColor = hex;
      description += ` Primary color changes to ${hex}.`;
      break;
    }
  }

  // --- Theme Keywords (basic) ---
  if (/\b(dark|night|moody|noir)\b/.test(lower)) {
    changes.primaryColor = changes.primaryColor || '#1a1a1a';
    description += " Theme shifts to a dark aesthetic.";
  }
  if (/\b(light|bright|airy|minimal)\b/.test(lower)) {
    changes.primaryColor = changes.primaryColor || '#ffffff';
    description += " Theme shifts to a light aesthetic.";
  }

  // If no keywords matched, mark for subagent processing
  const hasChanges = Object.keys(changes).length > 0;
  if (!hasChanges) {
    description = "Your request has been submitted and is being processed by our design team.";
  }

  return NextResponse.json({
    description,
    settingsDelta: changes,
    needsSubagent: !hasChanges, // flag for complex requests
  });
}
