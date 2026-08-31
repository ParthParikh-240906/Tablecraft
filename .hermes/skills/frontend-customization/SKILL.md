# Frontend Customization System

Generate layout/style changes for restaurant websites with safety constraints. Handles both small UI tweaks and full visual theme overhauls.

## Trigger
Use when a pending customization request needs to be processed into a deployable proposal.

## Safety Constraints (NEVER VIOLATE)
1. **Menu component** — MUST remain visible and functional
2. **Cart component** — MUST remain visible and functional
3. **Booking ("Book a Table") component** — MUST remain visible and functional
4. Only reposition or restyle — NEVER remove these elements
5. If a request would violate these, refuse and explain
6. Menu, cart, and booking must survive ANY theme transformation

## Input
You receive:
- `currentSettings` — The restaurant's current live settings
- `requestedChanges` — The parsed changes requested
- `userRequestText` — The original plain-text request from the owner
- `orgSlug` — The restaurant's URL slug
- `previewHtml` — Optional pre-generated preview (if owner already saw one)

## Output
Return a JSON object with:

```json
{
  "description": "Plain-language description for non-technical owner",
  "previewHtml": "Full HTML document with Tailwind CDN showing proposed layout",
  "codeChanges": [
    {
      "file": "path/to/file.tsx",
      "patch": "V4A patch format or description of change"
    }
  ],
  "settingsDelta": {
    "menuPosition": "left",
    "primaryColor": "#722F37",
    "accentColor": "#d4af37",
    "fontFamily": "Inter, sans-serif",
    "customCss": "CSS string for advanced effects",
    "theme": "dark-luxury"
  }
}
```

## Handling Scope of Requests

### Small UI Changes (position/styling tweaks)
- Move menu, cart, booking to a different position
- Change a single color or font
- Adjust spacing or padding
- These map directly to `settingsDelta` fields

### Large Theme Transformations (ambitious design prompts)
The user may describe a rich visual atmosphere (e.g. "futuristic luxury," "cinematic dark mode," "gold and chrome"). Handle these by:

1. **Abstract the core visual language** — extract 2-4 key style signals:
   - Dominant color(s) → `primaryColor`, `accentColor`
   - Typography mood → `fontFamily`
   - Texture/effects (metallic, glow, glass, holographic) → `customCss`
   - Layout feel (minimal, spacious, dense) → positions

2. **Map the aesthetic onto the restaurant's real structure** — the menu, cart, and booking stay functional but get styled to match the new theme.

3. **Generate rich `customCss`** — gradients, glows, glass-morphism (backdrop-filter), metallic text (gradient-clip), animations, scroll effects.

4. **Build a full preview HTML** that SHOWS the theme, not just describes it — use actual colors, gradients, typography so the owner sees the vibe.

### Example: "Futuristic luxury Porsche site" request
```
Theme: "Futuristic luxury / Motorsport Velocity x Monarch Luxe"
primaryColor: "#0a0a12"          // dark navy-black
accentColor: "#d4af37"           // metallic gold
secondaryColor: "#9aa0b5"        // brushed silver
fontFamily: "'Orbitron', 'Rajdhani', sans-serif"  // high-contrast tech type
customCss: |
  body { background: radial-gradient(...); }
  .menu-item:hover { glow + holographic highlight }
  h1 { background: linear-gradient(gold, silver); -webkit-background-clip: text; }
  .cart-btn { backdrop-filter: blur; border: 1px solid gold; }
```
The preview would show a dark navy page with gold glowing accents, metallic header text, glassy cart button — while menu items and booking form remain clearly present.

## Files to Edit
- `app/(public)/[orgSlug]/layout.tsx` — Main layout structure, theme, fonts
- `app/(public)/[orgSlug]/page.tsx` — Page-level components
- `app/(public)/[orgSlug]/globals.css` — CSS variables, base styles (create if missing)
- `app/(public)/[orgSlug]/_components/` — Extracted layout variants (create if needed)

## Layout Options

### menuPosition
- `left` — Fixed sidebar on left
- `right` — Fixed sidebar on right (default)
- `top` — Horizontal bar at top

### cartPosition
- `top-right` — Fixed button in corner (default)
- `bottom-right` — Floating button at bottom
- `floating-bottom` — Draggable bottom overlay
- `sidebar` — Slide-out panel

### bookingPosition
- `inline` — Embedded in page content (default)
- `modal` — Popup triggered by button
- `sidebar` — Slide-out panel
- `hero-section` — Prominent section at top

## Process
1. Read the current layout files for this org
2. Map the requested changes to layout options AND visual theme
3. Generate description in plain language (no technical jargon)
4. Create preview HTML with Tailwind CDN that shows the actual look
5. Identify exact file changes needed
6. Return structured JSON output

## Description Writing Guide
Write like a designer explaining to a non-technical restaurant owner:

> "Your website will get a dark luxury makeover. The background becomes a deep navy-black with gold accents — like a high-end sports car showroom. Your menu items get a subtle glow on hover, and the title gets a metallic gold gradient. The whole feel is sleek and premium, but everything still works exactly the same: customers can browse your menu, add to cart, and book a table just like before."

Never mention CSS, JSON, components, or technical terms.
