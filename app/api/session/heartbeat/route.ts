import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  acquireConsoleSlot,
  acquireSiteSlot,
  getCapacityPlan,
  getClientIpFromRequest,
  isFreeGated,
  parseCookie,
  SITE_SESSION_COOKIE,
  touchConsoleSlot,
} from "@/lib/capacity";
import { rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

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
  const rl = rateLimit(`session-heartbeat:${getClientIpFromRequest(request)}`, 60, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  let body: { kind?: unknown; orgId?: unknown; orgSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const kind = body.kind === "console" ? "console" : "site";
  const orgId = await resolveOrgId(body);
  if (!orgId) return NextResponse.json({ error: "orgId or orgSlug is required" }, { status: 400 });

  const plan = await getCapacityPlan(orgId);
  if (!isFreeGated(plan)) {
    return NextResponse.json({ ok: true, unlimited: true });
  }

  if (kind === "console") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("staff_users")
      .select("id")
      .eq("org_id", orgId)
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: "No access to this restaurant" }, { status: 403 });

    const touched = await touchConsoleSlot(orgId, user.id);
    if (touched) return NextResponse.json({ ok: true, allowed: true });

    const acquired = await acquireConsoleSlot({
      orgId,
      authUserId: user.id,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json(
      { ok: true, allowed: acquired.allowed, activeCount: acquired.activeCount },
      { status: acquired.allowed ? 200 : 429 },
    );
  }

  const cookie = parseCookie(request.headers.get("cookie"), SITE_SESSION_COOKIE);
  const acquired = await acquireSiteSlot({
    orgId,
    cookieValue: cookie,
    ip: getClientIpFromRequest(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    { ok: true, allowed: acquired.allowed, activeCount: acquired.activeCount },
    { status: acquired.allowed ? 200 : 429 },
  );
}
