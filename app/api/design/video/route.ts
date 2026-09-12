import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * POST /api/design/video — upload a background/hero video (MP4/WebM) to the
 * org-videos bucket and return its public URL. Mirrors the logo upload route.
 */
export async function POST(req: Request) {
  const admin = createAdminClient();
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const org_id = formData.get("org_id") as string;

  if (!file || !org_id) {
    return NextResponse.json({ error: "Missing file or org_id" }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Only MP4, WebM, or MOV videos are allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Video must be 25 MB or smaller" },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop() ?? "mp4";
  const fileName = `${org_id}/video-${Date.now()}.${ext}`;
  const { data, error: uploadError } = await admin.storage
    .from("org-videos")
    .upload(fileName, file, { upsert: false });

  if (uploadError) {
    console.error("video upload:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage
    .from("org-videos")
    .getPublicUrl(data.path);

  if (!publicUrl?.publicUrl) {
    return NextResponse.json({ error: "Could not get public URL" }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true, url: publicUrl.publicUrl });
}