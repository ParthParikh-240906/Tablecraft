# Frontend Customization System

Generate layout/style changes for restaurant websites with safety constraints.

## Trigger
Use when a pending customization request needs to be processed into a deployable proposal.

## Safety Constraints (NEVER VIOLATE)
1. **Menu component** — MUST remain visible and functional
2. **Cart component** — MUST remain visible and functional
3. **Booking component** — MUST remain visible and functional
4. Only reposition or restyle — NEVER remove these elements
5. If a request would violate these, refuse and explain

## Input
You receive:
- `currentSettings` — The restaurant's current live settings
- `requestedChanges` — The parsed changes requested
- `userRequestText` — The original plain-text request from the owner
- `orgSlug` — The restaurant's URL slug

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
    "primaryColor": "#722F37"
  }
}
```

## Files to Edit
- `app/(public)/[orgSlug]/layout.tsx` — Main layout structure
- `app/(public)/[orgSlug]/page.tsx` — Page-level components
- `app/(public)/[orgSlug]/_components/` — Extracted layout variants (create if needed)

## Layout Options

### menuPosition
- `left` — Fixed sidebar on left
- `right` — Fixed sidebar on right (default)
- `top` — Horizontal bar at top

### cartPosition
- `top-right` — Fixed button in corner (default)
- `bottom-right` — Floating button at bottom
- `floating` — Draggable overlay

### bookingPosition
- `inline` — Embedded in page content (default)
- `modal` — Popup triggered by button
- `sidebar` — Slide-out panel

## Process
1. Read the current layout files for this org
2. Map the requested changes to layout options
3. Generate description in plain language (no technical jargon)
4. Create preview HTML with Tailwind CDN
5. Identify exact file changes needed
6. Return structured JSON output

## Example Description
> "Your menu will move from the right side to the left side of the page. The 'Book a Table' button will appear as a prominent card above your menu items. The cart stays in the top-right corner. Your colors will change from dark gray to a warm burgundy tone."
