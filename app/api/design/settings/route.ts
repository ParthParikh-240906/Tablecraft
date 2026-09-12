import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge incoming design_settings into the stored object (top-level
 * namespaces). Each design subpage auto-saves only its own slice, so parallel
 * saves from different pages must not clobber each other.
 */
function mergeSettings(prev: Record<string, unknown> | null, incoming: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = { ...out[k], ...v };
    } else {
      out[k] = v;
    }
  }
  // Protect against saving an empty/slice-less body wiping the row
  if (Object.keys(incoming).length === 0) return out;
  return out;
}

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const { org_id, design_settings } = body;
  if (!org_id || !design_settings) {
    return NextResponse.json({ error: "Missing org_id or design_settings" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("organizations")
    .select("design_settings")
    .eq("id", org_id)
    .maybeSingle();

  const merged = mergeSettings(existing?.design_settings ?? null, design_settings);

  const { error } = await admin
    .from("organizations")
    .update({ design_settings: merged })
    .eq("id", org_id);

  if (error) {
    console.error("save design_settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/" + org_id);
  return NextResponse.json({ ok: true });
}
