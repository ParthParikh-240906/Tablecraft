import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const { org_id, name } = body;
  if (!org_id || !name) {
    return NextResponse.json({ error: "Missing org_id or name" }, { status: 400 });
  }

  const { error } = await admin
    .from("organizations")
    .update({ name })
    .eq("id", org_id);

  if (error) {
    console.error("update name:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
