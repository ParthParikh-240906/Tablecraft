import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const { org_id, text } = body;
  if (!org_id || !text || typeof text !== "object") {
    return NextResponse.json({ error: "Missing org_id or text" }, { status: 400 });
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
  const update: Record<string, string | null> = {};
  for (const [key, col] of Object.entries(columns)) {
    if (text[key] !== undefined) update[col] = text[key];
  }
  if (text.location !== undefined) {
    const locs = text.location.trim() ? text.location.split("\n").filter(Boolean) : [];
    update.branches = locs;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", org_id);

  if (error) {
    console.error("save text:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/" + org_id);
  return NextResponse.json({ ok: true });
}
