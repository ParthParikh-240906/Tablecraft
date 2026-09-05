import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const { org_id, old_index, new_index } = body;
  if (!org_id || old_index === undefined || new_index === undefined) {
    return NextResponse.json({ error: "Missing org_id, old_index, or new_index" }, { status: 400 });
  }

  // Reorder: swap positions
  const { data: a, error: e1 } = await admin
    .from("paragraphs")
    .select("id, position")
    .eq("org_id", org_id)
    .order("position", { ascending: true })
    .range(old_index, old_index);

  const { data: b, error: e2 } = await admin
    .from("paragraphs")
    .select("id, position")
    .eq("org_id", org_id)
    .order("position", { ascending: true })
    .range(new_index, new_index);

  if (e1 || e2 || !a?.[0] || !b?.[0]) {
    return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
  }

  const temp = a[0].position;
  await admin
    .from("paragraphs")
    .update({ position: b[0].position })
    .eq("id", a[0].id);
  await admin
    .from("paragraphs")
    .update({ position: temp })
    .eq("id", b[0].id);

  return NextResponse.json({ ok: true });
}
