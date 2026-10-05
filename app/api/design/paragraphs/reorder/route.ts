import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";

const MAX_INDEX = 1000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { org_id, old_index, new_index } = (body ?? {}) as {
      org_id?: unknown;
      old_index?: unknown;
      new_index?: unknown;
    };
    if (typeof org_id !== "string" || !org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    if (
      typeof old_index !== "number" || !Number.isInteger(old_index) || old_index < 0 || old_index > MAX_INDEX ||
      typeof new_index !== "number" || !Number.isInteger(new_index) || new_index < 0 || new_index > MAX_INDEX
    ) {
      return NextResponse.json({ error: "Invalid old_index or new_index" }, { status: 400 });
    }

    const admin = createAdminClient();
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
    if (e1) console.error("reorder paragraphs (a):", e1);
    if (e2) console.error("reorder paragraphs (b):", e2);
    return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
  }

  const temp = a[0].position;
  const { error: u1 } = await admin
    .from("paragraphs")
    .update({ position: b[0].position })
    .eq("id", a[0].id);
  const { error: u2 } = await admin
    .from("paragraphs")
    .update({ position: temp })
    .eq("id", b[0].id);
  if (u1 || u2) {
    if (u1) console.error("reorder paragraphs update (a):", u1);
    if (u2) console.error("reorder paragraphs update (b):", u2);
    return NextResponse.json({ error: "Could not reorder paragraphs. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/paragraphs/reorder POST unhandled:", err);
    return NextResponse.json({ error: "Could not reorder paragraphs. Please try again." }, { status: 500 });
  }
}
