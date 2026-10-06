import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireStaffForOrgId } from "@/lib/api-auth";

const MAX_TITLE_CHARS = 200;
const MAX_CONTENT_CHARS = 10000;
const MAX_URL_CHARS = 2048;
const IMAGE_POSITIONS = ["text-left", "text-right", "text-top", "text-bottom"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidImageUrl(v: unknown): boolean {
  if (v === null || v === "") return true;
  if (typeof v !== "string" || v.length > MAX_URL_CHARS) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { id } = await params;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("paragraphs")
      .select("org_id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
    }
    const auth = await requireStaffForOrgId(existing.org_id);
    if ("response" in auth) return auth.response;

    const {
      title,
      content,
      image_url,
      image_position,
      title_design,
      content_design,
    } = (body ?? {}) as {
      title?: unknown;
      content?: unknown;
      image_url?: unknown;
      image_position?: unknown;
      title_design?: unknown;
      content_design?: unknown;
    };

    const updates: Record<string, unknown> = {};
    if (title !== undefined) {
      if (title !== null && (typeof title !== "string" || title.length > MAX_TITLE_CHARS)) {
        return NextResponse.json({ error: `Title must be under ${MAX_TITLE_CHARS} characters` }, { status: 400 });
      }
      updates.title = title;
    }
    if (content !== undefined) {
      if (content !== null && (typeof content !== "string" || content.length > MAX_CONTENT_CHARS)) {
        return NextResponse.json({ error: `Content must be under ${MAX_CONTENT_CHARS} characters` }, { status: 400 });
      }
      updates.content = content;
    }
    if (image_url !== undefined) {
      if (!isValidImageUrl(image_url)) {
        return NextResponse.json({ error: "Invalid image_url" }, { status: 400 });
      }
      updates.image_url = image_url === "" ? null : image_url;
    }
    if (image_position !== undefined) {
      if (typeof image_position !== "string" || !IMAGE_POSITIONS.includes(image_position)) {
        return NextResponse.json({ error: "Invalid image_position" }, { status: 400 });
      }
      updates.image_position = image_position;
    }
    if (title_design !== undefined) {
      if (title_design !== null && (!isPlainObject(title_design) || JSON.stringify(title_design).length > 10000)) {
        return NextResponse.json({ error: "Invalid title_design" }, { status: 400 });
      }
      updates.title_design = title_design;
    }
    if (content_design !== undefined) {
      if (content_design !== null && (!isPlainObject(content_design) || JSON.stringify(content_design).length > 10000)) {
        return NextResponse.json({ error: "Invalid content_design" }, { status: 400 });
      }
      updates.content_design = content_design;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { error } = await admin
      .from("paragraphs")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("update paragraph:", error);
      return NextResponse.json({ error: "Could not save paragraph. Please try again." }, { status: 500 });
    }

    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/paragraphs/[id] PATCH unhandled:", err);
    return NextResponse.json({ error: "Could not save paragraph. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const admin = createAdminClient();
    // Delete image file from storage if present
    const { data: para } = await admin
      .from("paragraphs")
      .select("image_url, org_id")
      .eq("id", id)
      .maybeSingle();

    if (!para) {
      return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
    }
    const auth = await requireStaffForOrgId(para.org_id);
    if ("response" in auth) return auth.response;

    const { error } = await admin
      .from("paragraphs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("delete paragraph:", error);
      return NextResponse.json({ error: "Could not delete paragraph. Please try again." }, { status: 500 });
    }

    // Remove orphaned image from storage
    if (para?.image_url) {
      try {
        const url = new URL(para.image_url);
        const path = url.pathname.slice(1); // remove leading /
        await admin.storage.from("org-paragraph-images").remove([path]);
      } catch {
        // ignore bad URLs
      }
    }

    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/paragraphs/[id] DELETE unhandled:", err);
    return NextResponse.json({ error: "Could not delete paragraph. Please try again." }, { status: 500 });
  }
}
