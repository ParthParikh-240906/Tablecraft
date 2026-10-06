import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function safeExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "jpg";
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "jpg";
}

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

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }
    if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Image must be PNG, JPEG, WebP, or GIF" }, { status: 400 });
    }

    const admin = createAdminClient();
    const ext = safeExt(file.name ?? "image.jpg");
    const fileName = `${org_id}/${Date.now()}.${ext}`;
    const { data, error: uploadError } = await admin.storage
      .from("org-paragraph-images")
      .upload(fileName, file, { upsert: false });

    if (uploadError) {
      console.error("paragraph image upload:", uploadError);
      return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
    }

    const { data: publicUrl } = admin.storage
      .from("org-paragraph-images")
      .getPublicUrl(data.path);

    if (!publicUrl?.publicUrl) {
      return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: publicUrl.publicUrl });
  } catch (err) {
    console.error("design/paragraphs/image POST unhandled:", err);
    return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
  }
}
