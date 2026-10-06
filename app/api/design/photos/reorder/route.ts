import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";

const MAX_PHOTOS = 50;
const MAX_URL_CHARS = 2048;

function isValidPhotoUrl(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0 || v.length > MAX_URL_CHARS) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { org_id, photos } = (body ?? {}) as { org_id?: unknown; photos?: unknown };
    if (typeof org_id !== "string" || !org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    if (!Array.isArray(photos)) {
      return NextResponse.json({ error: "Missing photos array" }, { status: 400 });
    }
    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Too many photos (max ${MAX_PHOTOS})` }, { status: 400 });
    }
    if (!photos.every(isValidPhotoUrl)) {
      return NextResponse.json({ error: "Invalid photo URL in photos array" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("organizations")
      .update({ restaurant_photos: photos })
      .eq("id", org_id);

    if (error) {
      console.error("reorder photos:", error);
      return NextResponse.json({ error: "Could not reorder photos. Please try again." }, { status: 500 });
    }

    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/photos/reorder POST unhandled:", err);
    return NextResponse.json({ error: "Could not reorder photos. Please try again." }, { status: 500 });
  }
}
