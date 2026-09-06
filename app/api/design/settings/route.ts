import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const { org_id, design_settings } = body;
  if (!org_id || !design_settings) {
    return NextResponse.json({ error: "Missing org_id or design_settings" }, { status: 400 });
  }

  const { error } = await admin
    .from("organizations")
    .update({ design_settings })
    .eq("id", org_id);

  if (error) {
    console.error("save design_settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/" + org_id);
  return NextResponse.json({ ok: true });
}
