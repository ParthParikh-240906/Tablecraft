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

  // Delete old logo if present
  const { data: org } = await admin
    .from("organizations")
    .select("logo_url")
    .eq("id", org_id)
    .single();

  if (org?.logo_url) {
    try {
      const url = new URL(org.logo_url);
      const path = url.pathname.slice(1);
      await admin.storage.from("org-logos").remove([path]);
    } catch {
      // ignore bad URLs
    }
  }

  // Upload new logo
  const ext = file.name.split(".").pop() ?? "png";
  const fileName = `${org_id}/logo.${ext}`;
  const { data, error: uploadError } = await admin.storage
    .from("org-logos")
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error("logo upload:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get public URL
  const { data: publicUrl } = admin.storage
    .from("org-logos")
    .getPublicUrl(data.path);

  const newUrl = publicUrl?.publicUrl;
  if (!newUrl) {
    return NextResponse.json({ error: "Could not get public URL" }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("organizations")
    .update({ logo_url: newUrl })
    .eq("id", org_id);

  if (updateError) {
    console.error("update logo_url:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true, url: newUrl });
}
