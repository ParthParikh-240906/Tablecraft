import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireStaffForOrgId } from "@/lib/api-auth";

const MAX_TEXT_CHARS = 1000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { org_id, text } = (body ?? {}) as { org_id?: unknown; text?: unknown };
    if (typeof org_id !== "string" || !org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    if (!text || typeof text !== "object" || Array.isArray(text)) {
      return NextResponse.json({ error: "Missing or invalid text" }, { status: 400 });
    }

  // Partial update: only touch provided keys so per-field saves from the
  // design console never wipe other org columns.
  const columns: Record<string, string> = {
    tagline: "tagline",
    about_text: "about_text",
    about_title: "about_title",
    contact_heading: "contact_heading",
    location: "location",
    contact_phone: "contact_phone",
    contact_email: "contact_email",
    contact_address: "contact_address",
  };
  const update: Record<string, string | string[] | null> = {};
  for (const [key, col] of Object.entries(columns)) {
    const value = (text as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") {
      return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
    }
    if (typeof value === "string" && value.length > MAX_TEXT_CHARS) {
      return NextResponse.json({ error: `${key} must be under ${MAX_TEXT_CHARS} characters` }, { status: 400 });
    }
    update[col] = value;
  }
  if ((text as Record<string, unknown>).location !== undefined) {
    const raw = (text as Record<string, unknown>).location;
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "Invalid value for location" }, { status: 400 });
    }
    const locs = typeof raw === "string" && raw.trim()
      ? raw.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 50)
      : [];
    update.branches = locs;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", org_id);

  if (error) {
    console.error("save text:", error);
    return NextResponse.json({ error: "Could not save text. Please try again." }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/" + org_id);
  return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/text POST unhandled:", err);
    return NextResponse.json({ error: "Could not save text. Please try again." }, { status: 500 });
  }
}
