import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();

  const {
    org_id,
    position,
    title,
    content,
    image_url,
    image_position,
    title_design,
    content_design,
  } = body;

  if (!org_id) {
    return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
  }

  // Calculate next position
  const { data: existing } = await admin
    .from("paragraphs")
    .select("id")
    .eq("org_id", org_id);
  const nextPosition = (existing?.length ?? 0);

  const { data, error } = await admin
    .from("paragraphs")
    .insert({
      org_id,
      position: nextPosition,
      title: title ?? null,
      content: content ?? null,
      image_url: image_url ?? null,
      image_position: image_position ?? "text-left",
      title_design: title_design ?? null,
      content_design: content_design ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("create paragraph:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paragraph: data });
}
