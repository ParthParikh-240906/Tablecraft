import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Gates /console and /dashboard routes behind Supabase Auth and refreshes sessions.
 * Public site routes are untouched.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isConsole = pathname.startsWith("/console");
  const isLoginPage = pathname === "/console/login";
  const isDashboard = pathname === "/dashboard";

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
    // Keep the ?org= param (or whatever other query params were present)
    consoleUrl.search = request.nextUrl.search;
    return NextResponse.redirect(consoleUrl);
  }

  // Set selected_org cookie when ?org= param is present on console routes.
  // This lets users with multiple restaurants persist their choice across
  // navigation within the console without relying on URL params.
  const orgParam = request.nextUrl.searchParams.get("org");
  if (isConsole && !isLoginPage && orgParam) {
    // Forward the org header on the REQUEST so server components can read it
    // via headers(). Setting it on the response would never reach the handler.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-console-selected-org", orgParam);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.cookies.set("selected_org", orgParam, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return response;
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

  return response;
}

export const config = {
  matcher: ["/console/:path*", "/dashboard"],
};
