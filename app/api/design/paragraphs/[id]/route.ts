import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = createAdminClient();
  const body = await req.json();
  const { id } = await params;

  const {
    title,
    content,
    image_url,
    image_position,
    title_design,
    content_design,
  } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (image_url !== undefined) updates.image_url = image_url;
  if (image_position !== undefined) updates.image_position = image_position;
  if (title_design !== undefined) updates.title_design = title_design;
  if (content_design !== undefined) updates.content_design = content_design;

  const { error } = await admin
    .from("paragraphs")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("update paragraph:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = createAdminClient();
  const { id } = await params;

  // Delete image file from storage if present
  const { data: para } = await admin
    .from("paragraphs")
    .select("image_url")
    .eq("id", id)
    .single();

  const { error } = await admin
    .from("paragraphs")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("delete paragraph:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Remove orphaned image from storage
  if (para?.image_url) {
    const url = new URL(para.image_url);
    const path = url.pathname.slice(1); // remove leading /
    await admin.storage.from("org-paragraph-images").remove([path]);
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
