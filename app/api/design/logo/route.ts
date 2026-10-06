import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireStaffForOrgId } from "@/lib/api-auth";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function safeExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "png";
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png";
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
  // Delete existing logo file
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

  const { error } = await admin
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", org_id);

  if (error) {
    console.error("clear logo:", error);
    return NextResponse.json({ error: "Could not remove logo. Please try again." }, { status: 500 });
  }

    revalidatePath("/");
    revalidatePath("/" + org_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/logo DELETE unhandled:", err);
    return NextResponse.json({ error: "Could not remove logo. Please try again." }, { status: 500 });
  }
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
      return NextResponse.json({ error: "Logo must be under 5MB" }, { status: 400 });
    }
    if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Logo must be PNG, JPEG, WebP, or GIF" }, { status: 400 });
    }

    const admin = createAdminClient();
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
  const ext = safeExt(file.name ?? "logo.png");
  const fileName = `${org_id}/logo.${ext}`;
  const { data, error: uploadError } = await admin.storage
    .from("org-logos")
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error("logo upload:", uploadError);
    return NextResponse.json({ error: "Could not upload logo. Please try again." }, { status: 500 });
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
    return NextResponse.json({ error: "Could not save logo. Please try again." }, { status: 500 });
  }

    revalidatePath("/");
    revalidatePath("/" + org_id);
    return NextResponse.json({ ok: true, url: newUrl });
  } catch (err) {
    console.error("design/logo POST unhandled:", err);
    return NextResponse.json({ error: "Could not upload logo. Please try again." }, { status: 500 });
  }
}
