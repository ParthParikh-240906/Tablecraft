import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const { org_id, photos } = body;
  if (!org_id || !Array.isArray(photos)) {
    return NextResponse.json({ error: "Missing org_id or photos array" }, { status: 400 });
  }

  const { error } = await admin
    .from("organizations")
    .update({ restaurant_photos: photos })
    .eq("id", org_id);

  if (error) {
    console.error("reorder photos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
