/**
 * Normalize table labels parsed from order customer_name values.
 *
 * Orders created from tables store customer_name as "Table 1, 2, 3" where
 * the parts may or may not carry the "Table " prefix, may vary in case /
 * whitespace, and may have a trailing " Edit" marker. Normalizing both the
 * stored parts and the DB labels the same way prevents stuck-occupied
 * tables when freeing on status change / delete.
 */

const EDIT_SUFFIX_RE = /\s+Edit$/;
const TABLE_PREFIX_RE = /^Table\s+/i;

export function stripEditSuffix(name: string): string {
  return name.replace(EDIT_SUFFIX_RE, "");
}

/** "Table 7" -> "7", "  TABLE  A1 " -> "a1". Comparison key only. */
export function normalizeTableLabel(label: string): string {
  return stripEditSuffix(label).trim().replace(TABLE_PREFIX_RE, "").trim().toLowerCase();
}

/** Split a "Table 1, 2, 3" style customer_name into normalized parts. */
export function parseTableLabelsFromCustomerName(customerName: string): string[] {
  const raw = stripEditSuffix(customerName).trim();
  if (!/^Table\s+/i.test(raw)) return [];
  return raw
    .replace(TABLE_PREFIX_RE, "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
}

/** True when customer_name refers to dine-in table(s). */
export function isTableOrderName(customerName: string): boolean {
  return /^Table\s+/i.test(stripEditSuffix(customerName).trim());
}
