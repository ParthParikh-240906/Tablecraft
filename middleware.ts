import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEMO_EMAIL = "demo@tablecraft.app";

/**
 * Gates /console and /dashboard routes behind Supabase Auth and refreshes sessions.
 * Public site routes are untouched.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isConsole = pathname.startsWith("/console");
  const isLoginPage = pathname === "/console/login";
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isCreateRestaurant = pathname === "/restaurants/create" || pathname.startsWith("/restaurants/create/");
  const isDemoApi = pathname.startsWith("/api/demo/");

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

  // Allow demo API routes without auth
  if (isDemoApi) {
    return response;
  }

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
            .eq("email", DEMO_EMAIL)
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
  matcher: ["/console/:path*", "/dashboard", "/dashboard/:path*", "/restaurants/create"],
};
