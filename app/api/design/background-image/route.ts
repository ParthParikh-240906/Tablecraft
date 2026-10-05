import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
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
  // Delete old background if present
  const { data: org } = await admin
    .from("organizations")
    .select("background_image_url, slug")
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
  const ext = safeExt(file.name ?? "background.jpg");
  const fileName = `${org_id}/background.${ext}`;
  const { data, error: uploadError } = await admin.storage
    .from("org-backgrounds")
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error("background upload:", uploadError);
    return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
  }

  const { data: publicUrl } = admin.storage
    .from("org-backgrounds")
    .getPublicUrl(data.path);

  const newUrl = publicUrl?.publicUrl;
  if (!newUrl) {
    return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("organizations")
    .update({ background_image_url: newUrl })
    .eq("id", org_id);

  if (updateError) {
    console.error("update background_image_url:", updateError);
    return NextResponse.json({ error: "Could not save image. Please try again." }, { status: 500 });
  }

  // Revalidate the correct public route using the org slug
  if (org?.slug) {
    revalidatePath("/" + org.slug);
  }
  revalidatePath("/");
  return NextResponse.json({ ok: true, url: newUrl });
  } catch (err) {
    console.error("design/background-image POST unhandled:", err);
    return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { org_id } = (body ?? {}) as { org_id?: unknown };

    if (typeof org_id !== "string" || !org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    const admin = createAdminClient();
  // Delete existing background file
  const { data: org } = await admin
    .from("organizations")
    .select("background_image_url, slug")
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
    return NextResponse.json({ error: "Could not remove image. Please try again." }, { status: 500 });
  }

  if (org?.slug) {
    revalidatePath("/" + org.slug);
  }
  revalidatePath("/");
  return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/background-image DELETE unhandled:", err);
    return NextResponse.json({ error: "Could not remove image. Please try again." }, { status: 500 });
  }
}
