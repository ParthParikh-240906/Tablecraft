import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireStaffForOrgId } from "@/lib/api-auth";

const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function safeExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "mp4";
  return ["mp4", "webm", "mov"].includes(ext) ? ext : "mp4";
}

/**
 * POST /api/design/video — upload a background/hero video (MP4/WebM) to the
 * org-videos bucket and return its public URL. Mirrors the logo upload route.
 */
export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  try {
    const file = formData.get("file") as File | null;
    const org_id = formData.get("org_id") as string | null;

    if (!file || !org_id) {
      return NextResponse.json({ error: "Missing file or org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

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

    const admin = createAdminClient();
    const ext = safeExt(file.name ?? "video.mp4");
    const fileName = `${org_id}/video-${Date.now()}.${ext}`;
    const { data, error: uploadError } = await admin.storage
      .from("org-videos")
      .upload(fileName, file, { upsert: false });

    if (uploadError) {
      console.error("video upload:", uploadError);
      return NextResponse.json({ error: "Could not upload video. Please try again." }, { status: 500 });
    }

    const { data: publicUrl } = admin.storage
      .from("org-videos")
      .getPublicUrl(data.path);

    if (!publicUrl?.publicUrl) {
      return NextResponse.json({ error: "Could not upload video. Please try again." }, { status: 500 });
    }

    revalidatePath("/");
    return NextResponse.json({ ok: true, url: publicUrl.publicUrl });
  } catch (err) {
    console.error("design/video POST unhandled:", err);
    return NextResponse.json({ error: "Could not upload video. Please try again." }, { status: 500 });
  }
}