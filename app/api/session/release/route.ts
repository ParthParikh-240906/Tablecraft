import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseCookie,
  releaseConsoleSlot,
  releaseSiteSlot,
  SITE_SESSION_COOKIE,
} from "@/lib/capacity";

export const dynamic = "force-dynamic";

async function resolveOrgId(body: { orgId?: unknown; orgSlug?: unknown }): Promise<string | null> {
  if (typeof body.orgId === "string" && body.orgId) return body.orgId;
  if (typeof body.orgSlug === "string" && body.orgSlug) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", body.orgSlug)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  }
  return null;
}

export async function POST(request: Request) {
  let body: { kind?: unknown; orgId?: unknown; orgSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const kind = body.kind === "console" ? "console" : "site";
  const orgId = await resolveOrgId(body);
  if (!orgId) return NextResponse.json({ error: "orgId or orgSlug is required" }, { status: 400 });

  if (kind === "console") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: true });
    await releaseConsoleSlot(orgId, user.id);
    return NextResponse.json({ ok: true });
  }

  const cookie = parseCookie(request.headers.get("cookie"), SITE_SESSION_COOKIE);
  await releaseSiteSlot(orgId, cookie);
  return NextResponse.json({ ok: true });
}
