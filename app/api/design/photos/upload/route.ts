import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const admin = createAdminClient();
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const org_id = formData.get("org_id") as string;

  if (!file || !org_id) {
    return NextResponse.json({ error: "Missing file or org_id" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${org_id}/${Date.now()}.${ext}`;
  const { data, error: uploadError } = await admin.storage
    .from("org-restaurant-images")
    .upload(fileName, file, { upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage
    .from("org-restaurant-images")
    .getPublicUrl(data.path);

  revalidatePath("/");
  return NextResponse.json({ ok: true, url: publicUrl?.publicUrl });
}
