import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireStaffForOrgId } from "@/lib/api-auth";

const MAX_TOP_LEVEL_KEYS = 50;
const MAX_SETTINGS_BYTES = 100_000;

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { org_id, design_settings } = (body ?? {}) as {
      org_id?: unknown;
      design_settings?: unknown;
    };
    if (typeof org_id !== "string" || !org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    if (!isPlainObject(design_settings)) {
      return NextResponse.json({ error: "Missing or invalid design_settings" }, { status: 400 });
    }
    if (Object.keys(design_settings).length > MAX_TOP_LEVEL_KEYS) {
      return NextResponse.json({ error: "Settings payload too large" }, { status: 400 });
    }
    let serialized = "";
    try {
      serialized = JSON.stringify(design_settings);
    } catch {
      return NextResponse.json({ error: "Invalid design_settings" }, { status: 400 });
    }
    if (serialized.length > MAX_SETTINGS_BYTES) {
      return NextResponse.json({ error: "Settings payload too large" }, { status: 400 });
    }

    const admin = createAdminClient();
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
      return NextResponse.json({ error: "Could not save settings. Please try again." }, { status: 500 });
    }

    revalidatePath("/");
    revalidatePath("/" + org_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/settings POST unhandled:", err);
    return NextResponse.json({ error: "Could not save settings. Please try again." }, { status: 500 });
  }
}
