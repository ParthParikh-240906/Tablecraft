import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  acquireSiteSlot,
  getCapacityPlan,
  getCapacityPlanBySlug,
  isFreeGated,
  parseCookie,
  SITE_SESSION_COOKIE,
} from "@/lib/capacity";
import { getActiveDomainByHost } from "@/lib/domain-store";
import { getPlatformBaseUrl, isPlatformHost, normalizeHost } from "@/lib/site-url";

/**
 * Next.js 16 Proxy (formerly middleware).
 *
 * Two jobs:
 *  1. Console/dashboard auth + selected-org cookie (unchanged behaviour).
 *  2. Host-based routing + Free-plan capacity gating for public restaurant
 *     pages. Customer domains are resolved from organization_domains and
 *     rewritten to the existing /[orgSlug] routes.
 */

const TOP_LEVEL_APP_ROUTES = new Set([
  "console",
  "dashboard",
  "signin",
  "signup",
  "login",
  "privacy",
  "terms",
  "mock",
  "restaurants",
  "auth",
  "api",
  "stripe-connected",
  "capacity",
  "_next",
]);

function isDocumentRequest(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isPrefetch(request: NextRequest): boolean {
  if (request.headers.get("next-router-prefetch")) return true;
  const purpose = `${request.headers.get("sec-purpose") || ""} ${request.headers.get("purpose") || ""}`;
  return purpose.toLowerCase().includes("prefetch");
}

function isPublicRestaurantPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname === "/") return false;
  const first = pathname.split("/")[1] || "";
  if (!first || TOP_LEVEL_APP_ROUTES.has(first)) return false;
  return /^[a-z0-9-]{1,80}$/i.test(first);
}

/** Paid customers returning from Stripe must never be blocked by capacity. */
function isCheckoutReturnPath(pathname: string): boolean {
  return /\/cart\/success\/?$/.test(pathname);
}

function siteCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

function attachSiteCookie(
  response: NextResponse,
  cookieValue: string | null,
  hadCookie: boolean,
) {
  if (!cookieValue || hadCookie) return response;
  response.cookies.set(SITE_SESSION_COOKIE, cookieValue, siteCookieOptions());
  return response;
}

async function handleCustomDomain(request: NextRequest): Promise<NextResponse> {
  const host = normalizeHost(request.headers.get("host"));
  const pathname = request.nextUrl.pathname;

  // The capacity page is public and must never be re-gated. ACME HTTP-01
  // challenges must reach Vercel so SSL can be issued before the domain is
  // marked active in our DB.
  if (pathname === "/capacity" || pathname.startsWith("/.well-known")) {
    return NextResponse.next();
  }

  // Console/auth/marketing-only pages stay on the Tablecraft host.
  if (
    pathname === "/console" ||
    pathname.startsWith("/console/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/signin" ||
    pathname === "/signup" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/mock" ||
    pathname === "/stripe-connected" ||
    pathname === "/restaurants" ||
    pathname.startsWith("/restaurants/")
  ) {
    const url = new URL(`${pathname}${request.nextUrl.search}`, getPlatformBaseUrl());
    return NextResponse.redirect(url, 308);
  }

  const active = await getActiveDomainByHost(host);
  if (!active) {
    return new NextResponse(
      "<!doctype html><html><body style=\"font-family:system-ui;padding:3rem;text-align:center\"><h1>Domain not found</h1><p>This domain is not connected to a Tablecraft site.</p></body></html>",
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tc-custom-domain", "1");
  requestHeaders.set("x-tc-org-slug", active.slug);
  requestHeaders.set("x-tc-request-host", host);
  requestHeaders.set("x-tc-canonical-host", active.hostname);

  if (isDocumentRequest(request) && !isPrefetch(request)) {
    const plan = await getCapacityPlan(active.orgId);

    // Free has 0 custom domains. If a downgrade webhook was missed, stop
    // serving the domain immediately instead of relying on the Launch page.
    if (isFreeGated(plan)) {
      return new NextResponse(
        "<!doctype html><html><body style=\"font-family:system-ui;padding:3rem;text-align:center\"><h1>This domain is not active</h1><p>The restaurant&apos;s Tablecraft site is still available.</p></body></html>",
        { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
  }

  const targetPath = pathname === "/" ? `/${active.slug}` : `/${active.slug}${pathname}`;
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = targetPath;

  return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
}

async function handlePublicPlatform(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  if (
    !isDocumentRequest(request) ||
    isPrefetch(request) ||
    !isPublicRestaurantPath(pathname) ||
    isCheckoutReturnPath(pathname)
  ) {
    return NextResponse.next();
  }

  const slug = pathname.split("/")[1] || "";
  const plan = await getCapacityPlanBySlug(slug);
  if (!plan.orgId || !isFreeGated(plan)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tc-capacity-gated", "1");

  const existing = parseCookie(request.headers.get("cookie"), SITE_SESSION_COOKIE);
  const decision = await acquireSiteSlot({
    orgId: plan.orgId,
    cookieValue: existing,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown",
    userAgent: request.headers.get("user-agent"),
  });

  if (!decision.allowed) {
    const capacityUrl = request.nextUrl.clone();
    capacityUrl.pathname = "/capacity";
    capacityUrl.search = "?kind=site";
    const blocked = NextResponse.rewrite(capacityUrl, { request: { headers: requestHeaders } });
    blocked.headers.set("Retry-After", "120");
    return blocked;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return attachSiteCookie(response, decision.cookieValue, Boolean(existing));
}

export async function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));

  // Customer domain: no Supabase auth client, no auth cookies.
  if (host && !isPlatformHost(host)) {
    return handleCustomDomain(request);
  }

  const { pathname } = request.nextUrl;

  // Public restaurant pages only need host/capacity handling; skip Supabase auth.
  const isConsole = pathname.startsWith("/console");
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isCreateRestaurant = pathname === "/restaurants/create" || pathname.startsWith("/restaurants/create/");

  if (!isConsole && !isDashboard && !isCreateRestaurant) {
    return handlePublicPlatform(request);
  }

  const isLoginPage = pathname === "/console/login";

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is already logged in and visits the login page, redirect to console
  // preserving any ?org= param so the selected_org cookie gets set correctly.
  if (user && isLoginPage) {
    const consoleUrl = request.nextUrl.clone();
    consoleUrl.pathname = "/console";
    consoleUrl.search = request.nextUrl.search;
    return NextResponse.redirect(consoleUrl);
  }

  // Set selected_org cookie when ?org= param is present on console routes.
  const orgParam = request.nextUrl.searchParams.get("org");
  if (isConsole && !isLoginPage && orgParam) {
    let resolvedOrgId = orgParam;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgParam);
    if (!isUUID) {
      try {
        const { data: org } = await supabase
          .from("public_organizations")
          .select("id")
          .eq("slug", orgParam)
          .single();
        if (org?.id) resolvedOrgId = org.id;
      } catch {
        // fall through — store the raw param, layout will validate
      }
    }
    const isResolvedUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedOrgId);
    const resp = NextResponse.next({ request });
    if (isResolvedUUID) {
      resp.cookies.set("selected_org", resolvedOrgId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      resp.headers.set("x-console-selected-org", resolvedOrgId);
      // Mark demo orgs so the frontend can show demo UI
      if (user) {
        try {
          const { data: staff } = await supabase
            .from("staff_users")
            .select("id")
            .eq("org_id", resolvedOrgId)
            .eq("email", "demo@tablecraft.app")
            .maybeSingle();
          if (staff) {
            resp.headers.set("x-demo-org", resolvedOrgId);
          }
        } catch {
          // ignore
        }
      }
    }
    return resp;
  }

  // If unauthenticated user tries to access protected console paths
  if (!user && isConsole && !isLoginPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/console/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If unauthenticated user tries to access the dashboard
  if (!user && isDashboard) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/signin";
    loginUrl.searchParams.set("next", "/dashboard");
    return NextResponse.redirect(loginUrl);
  }

  // If unauthenticated user tries to create a restaurant
  if (!user && isCreateRestaurant) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/signin";
    loginUrl.searchParams.set("next", "/restaurants/create");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|\\.well-known|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
