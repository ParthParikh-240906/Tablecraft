// Manual preset system for restaurant theming.
// No AI integration - fixed presets with 3-color swatches.

export const THEME_PRESETS = {
  "midnight-ember": {
    name: "Midnight Ember",
    main: "#141414",
    text: "#f5f5f4",
    highlight: "#f97316",
  },
  "racing-silver": {
    name: "Racing Silver",
    main: "#1c1c1e",
    text: "#f5f5f4",
    highlight: "#c1121f",
  },
  "coastal-warmth": {
    name: "Coastal Warmth",
    main: "#2f3d2f",
    text: "#f4ede0",
    highlight: "#d4a017",
  },
  "velvet-club": {
    name: "Velvet Club",
    main: "#3b0f1a",
    text: "#f0e6d2",
    highlight: "#b8862c",
  },
  "clean-slate": {
    name: "Clean Slate",
    main: "#fafaf9",
    text: "#18181b",
    highlight: "#0ea5e9",
  },
} as const;

export type ThemePresetKey = keyof typeof THEME_PRESETS;

export const DEFAULT_PRESET: ThemePresetKey = "midnight-ember";

/**
 * Get preset colors from a preset key.
 */
export function getPresetColors(presetKey: ThemePresetKey) {
  return THEME_PRESETS[presetKey];
}

/**
 * Validate a preset key.
 */
export function isValidPreset(key: string): key is ThemePresetKey {
  return key in THEME_PRESETS;
}