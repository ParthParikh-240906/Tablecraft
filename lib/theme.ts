// Unified theme system - all restaurants use the same theme as the marketing page

export const UNIFIED_THEME = {
  main: "#0f0f0f",
  text: "#f5f5f4",
  highlight: "#ff6b35",
} as const;

/**
 * Get the unified theme colors (all restaurants use this).
 */
export function getThemeColors() {
  return UNIFIED_THEME;
}