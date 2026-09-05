import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const { org_id, text } = body;
  if (!org_id || !text) {
    return NextResponse.json({ error: "Missing org_id or text" }, { status: 400 });
  }

  const { error } = await admin
    .from("organizations")
    .update({
      tagline: text.tagline ?? null,
      about_text: text.about_text ?? null,
      about_title: text.about_title ?? null,
      contact_heading: text.contact_heading ?? null,
      contact_phone: text.contact_phone ?? null,
      contact_email: text.contact_email ?? null,
      contact_address: text.contact_address ?? null,
    })
    .eq("id", org_id);

  if (error) {
    console.error("save text:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
