// Unified theme system - all restaurants use the same theme as the marketing page

export const UNIFIED_THEME = {
  main: "#0f0f0f",
  text: "#f5f5f4",
  highlight: "#f97316",
} as const;

/**
 * Get the unified theme colors (all restaurants use this).
 */
export function getThemeColors() {
  return UNIFIED_THEME;
}