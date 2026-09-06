import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const org_id = formData.get("org_id") as string;

  if (!file || !org_id) {
    return NextResponse.json({ error: "Missing file or org_id" }, { status: 400 });
  }

  // Delete old background if present
  const { data: org } = await admin
    .from("organizations")
    .select("background_image_url")
    .eq("id", org_id)
    .single();

  if (org?.background_image_url) {
    try {
      const url = new URL(org.background_image_url);
      const path = url.pathname.slice(1);
      await admin.storage.from("org-backgrounds").remove([path]);
    } catch { /* ignore */ }
  }

  // Upload new background
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${org_id}/background.${ext}`;
  const { data, error: uploadError } = await admin.storage
    .from("org-backgrounds")
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error("background upload:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage
    .from("org-backgrounds")
    .getPublicUrl(data.path);

  const newUrl = publicUrl?.publicUrl;
  if (!newUrl) {
    return NextResponse.json({ error: "Could not get public URL" }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("organizations")
    .update({ background_image_url: newUrl })
    .eq("id", org_id);

  if (updateError) {
    console.error("update background_image_url:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/" + org_id);
  return NextResponse.json({ ok: true, url: newUrl });
}

export async function DELETE(req: Request) {
  const admin = createAdminClient();
  const body = await req.json();
  const { org_id } = body;

  if (!org_id) {
    return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
  }

  // Delete existing background file
  const { data: org } = await admin
    .from("organizations")
    .select("background_image_url")
    .eq("id", org_id)
    .single();

  if (org?.background_image_url) {
    try {
      const url = new URL(org.background_image_url);
      const path = url.pathname.slice(1);
      await admin.storage.from("org-backgrounds").remove([path]);
    } catch { /* ignore */ }
  }

  const { error } = await admin
    .from("organizations")
    .update({ background_image_url: null })
    .eq("id", org_id);

  if (error) {
    console.error("delete background:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
