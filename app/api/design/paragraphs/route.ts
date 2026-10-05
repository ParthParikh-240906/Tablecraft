import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";

const MAX_TITLE_CHARS = 200;
const MAX_CONTENT_CHARS = 10000;
const MAX_URL_CHARS = 2048;
const IMAGE_POSITIONS = ["text-left", "text-right", "text-top", "text-bottom"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidImageUrl(v: unknown): boolean {
  if (v === null) return true;
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
    const {
      org_id,
      title,
      content,
      image_url,
      image_position,
      title_design,
      content_design,
    } = (body ?? {}) as {
      org_id?: unknown;
      position?: unknown;
      title?: unknown;
      content?: unknown;
      image_url?: unknown;
      image_position?: unknown;
      title_design?: unknown;
      content_design?: unknown;
    };

    if (typeof org_id !== "string" || !org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    if (title !== undefined && title !== null && (typeof title !== "string" || title.length > MAX_TITLE_CHARS)) {
      return NextResponse.json({ error: `Title must be under ${MAX_TITLE_CHARS} characters` }, { status: 400 });
    }
    if (content !== undefined && content !== null && (typeof content !== "string" || content.length > MAX_CONTENT_CHARS)) {
      return NextResponse.json({ error: `Content must be under ${MAX_CONTENT_CHARS} characters` }, { status: 400 });
    }
    if (image_url !== undefined && !isValidImageUrl(image_url)) {
      return NextResponse.json({ error: "Invalid image_url" }, { status: 400 });
    }
    if (image_position !== undefined && (typeof image_position !== "string" || !IMAGE_POSITIONS.includes(image_position))) {
      return NextResponse.json({ error: "Invalid image_position" }, { status: 400 });
    }
    for (const [key, val] of [["title_design", title_design], ["content_design", content_design]] as const) {
      if (val !== undefined && val !== null) {
        if (!isPlainObject(val) || JSON.stringify(val).length > 10000) {
          return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
        }
      }
    }

    const admin = createAdminClient();
  // Calculate next position
  const { data: existing } = await admin
    .from("paragraphs")
    .select("id")
    .eq("org_id", org_id);
  const nextPosition = (existing?.length ?? 0);

  const { data, error } = await admin
    .from("paragraphs")
    .insert({
      org_id,
      position: nextPosition,
      title: title ?? null,
      content: content ?? null,
      image_url: image_url ?? null,
      image_position: image_position ?? "text-left",
      title_design: title_design ?? null,
      content_design: content_design ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("create paragraph:", error);
    return NextResponse.json({ error: "Could not create paragraph. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paragraph: data });
  } catch (err) {
    console.error("design/paragraphs POST unhandled:", err);
    return NextResponse.json({ error: "Could not create paragraph. Please try again." }, { status: 500 });
  }
}
