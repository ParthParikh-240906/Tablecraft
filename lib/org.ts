import { createClient } from "@/lib/supabase/server";
import { hydrateSettings } from "@/lib/design";
import { cookies } from "next/headers";

/**
 * Resolve the active staff row for a user, respecting the selected-org cookie.
 *
 * When a user owns multiple restaurants, the console layout stores the
 * chosen restaurant in a `selected_org` cookie (set by middleware when
 * ?org=<id> is present). This helper reads that cookie and returns the
 * matching staff row, falling back to the first row if no selection exists.
 */
/**
 * Result of resolving the active staff row for a user.
 * `isMultiOrg` is true when the user has multiple restaurants and no
 * `selected_org` cookie is set — the caller should redirect to /console/select.
 */
export interface ActiveStaffResult {
  staff: any;
  count: number;
  isMultiOrg: boolean;
}

export async function getActiveStaffRow(
  userId: string,
  urlOrgId?: string,
): Promise<ActiveStaffResult | null> {
  const supabase = await createClient();
  const { data: staffRows } = await supabase
    .from("staff_users")
    .select("org_id, role, email, organizations(name, slug, theme_color)")
    .eq("auth_user_id", userId);

  const rows = staffRows ?? [];
  if (rows.length === 0) return null;

  // URL param takes priority over the cookie — this lets each tab
  // independently select its org even when the cookie is shared across tabs.
  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get("selected_org")?.value;
  const selectedOrgId = urlOrgId ?? cookieOrgId;

  let selected: any = rows[0];

  // Multiple orgs — check for a persisted selection (URL param or cookie)
  if (rows.length > 1 && selectedOrgId) {
    const matched = rows.find((r: any) => {
      const orgId = r.org_id ?? (Array.isArray(r.organizations) ? (r.organizations as any[])[0]?.id : r.organizations?.id);
      return orgId === selectedOrgId;
    });
    if (matched) selected = matched;
  }

  return {
    staff: selected,
    count: rows.length,
    isMultiOrg: rows.length > 1 && !selectedOrgId,
  };
}

/**
 * Resolve the active org ID for a user.
 * Respects the `selected_org` cookie; falls back to the first org.
 * Returns null if the user has no staff rows.
 */
export async function getActiveOrgId(userId: string): Promise<string | null> {
  const result = await getActiveStaffRow(userId);
  if (!result) return null;
  return result.staff.org_id ?? null;
}

// ─── Module-level request cache (dedupes identical queries within one request) ───
interface CacheEntry<T> {
  value: T;
  expires: number;
}
const _cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 15_000; // 15s — short enough to stay fresh, long enough to dedupe

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = _cache.get(key);
  if (entry && entry.expires > Date.now()) return Promise.resolve(entry.value);
  return fn().then((value) => {
    _cache.set(key, { value, expires: Date.now() + CACHE_TTL });
    return value;
  });
}

/**
 * Fetch organization + paragraphs for the design console, and hydrate the
 * design settings (v1 → v2) so every subpage renders immediately.
 * Returns null when the org doesn't exist.
 */
export async function getDesignData(orgId: string) {
  const [org, paragraphs] = await Promise.all([getOrgById(orgId), getParagraphsByOrg(orgId)]);
  if (!org) return null;
  return {
    org,
    paragraphs: paragraphs ?? [],
    settings: hydrateSettings(org.design_settings as Record<string, any> | null | undefined),
    orgName: org.name ?? "Restaurant",
    slug: org.slug,
    logoUrl: org.logo_url ?? null,
  };
}

/**
 * List all public organizations (no auth required).
 */
export async function getOrgs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, theme_color, tagline")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getOrgs:", error);
    return [];
  }
  return data;
}

/**
 * Resolve an organization by its URL slug.
 * Used by the public site pages (landing, menu) so they stay consistent.
 * Returns null if the org doesn't exist (caller renders notFound()).
 */
/**
 * Fetch an organization by its UUID (console pages use org_id, not slug).
 * Returns null on error or not found.
 */
export async function getOrgById(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, theme_color, theme_text_color, theme_secondary_color, theme_font_pair, theme_motif, tagline, about_text, about_title, contact_heading, location, restaurant_image_url, branches, contact_phone, contact_email, contact_address, design_settings, restaurant_photos, background_image_url")
    .eq("id", orgId)
    .maybeSingle();
  if (error) { console.error("getOrgById:", error); return null; }
  return data;
}

export async function getOrgBySlug(slug: string) {
  return cached(`org:${slug}`, async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, logo_url, theme_color, theme_text_color, theme_secondary_color, theme_font_pair, theme_motif, tagline, about_text, about_title, contact_heading, location, restaurant_image_url, branches, contact_phone, contact_email, contact_address, design_settings, restaurant_photos, background_image_url")
      .eq("slug", slug)
      .maybeSingle();
    if (error) { console.error("getOrgBySlug:", error); return null; }
    return data;
  });
}

/**
 * Fetch org + paragraphs in parallel — replaces two sequential queries.
 */
export async function getOrgAndParagraphs(slug: string) {
  const org = await getOrgBySlug(slug);
  if (!org) return { org: null, paragraphs: [] as any[] };
  const paragraphs = (await getParagraphsByOrg(org.id)) ?? [];
  return { org, paragraphs };
}

/**
 * Fetch paragraphs for an org, ordered by position.
 */
export async function getParagraphsByOrg(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paragraphs")
    .select("id, position, title, content, image_url, image_position, title_design, content_design")
    .eq("org_id", orgId)
    .order("position", { ascending: true });

  if (error) {
    console.error("getParagraphsByOrg:", error);
    return [];
  }
  return data;
}

/**
 * Fetch the available menu items for an org, grouped by category.
 * Uses the public read policy (only available=true items are returned).
 */
export async function getMenuByOrg(orgId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price, category, image_url")
    .eq("org_id", orgId)
    .eq("available", true)
    .order("category_sort_order")
    .order("sort_order");

  if (error) {
    console.error("getMenuByOrg:", error);
    return [];
  }

  // Group by category, preserving alphabetical category order.
  const grouped = new Map<string, typeof data>();
  for (const item of data) {
    const cat = item.category ?? "Other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  return Array.from(grouped.entries()).map(([category, items]) => ({
    category,
    items,
  }));
}