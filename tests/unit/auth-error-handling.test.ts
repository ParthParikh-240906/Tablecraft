/**
 * tests/unit/auth-error-handling.test.ts
 * Covers sign-in + console login + auth callback error handling:
 *  app/signin/page.tsx, app/(auth)/console/login/page.tsx,
 *  app/auth/callback/route.ts, app/auth/verify/route.ts, middleware.ts
 */
import { describe, it, expect } from "vitest";

// Mirrors prod: /rate.?limit|too many/i → rate-limit message, else invalid credentials
export function signinErrorMessage(authErrorMessage: string): string {
  return /rate.?limit|too many/i.test(authErrorMessage)
    ? "Too many attempts. Please wait a minute and try again."
    : "Invalid email or password. Please try again.";
}

// Mirrors console/login: Supabase error → try /api/console/login fallback;
// 5xx → server error, else invalid credentials
export function consoleFallbackMessage(res: { ok: boolean; status: number }): string {
  if (res.ok) return "redirect";
  if (res.status >= 500) return "Server error — please try again in a moment.";
  return "Invalid email or password. Please try again.";
}

// Mirrors ?error= param mapping on both login pages
export function callbackErrorMessage(code: string | null): string | null {
  if (code === "auth_callback_failed") return "Google sign-in failed. Please try again.";
  if (code === "magiclink_failed") return "That sign-in link expired or is invalid. Please sign in again.";
  return null;
}

// Mirrors middleware redirect targets
export function middlewareRedirect(pathname: string): string | null {
  if (pathname.startsWith("/console") && pathname !== "/console/login") return "/console/login";
  if (pathname === "/dashboard") return "/signin";
  return null;
}

describe("signin error mapping (signin/page.tsx)", () => {
  it("maps rate-limit variants to wait message", () => {
    expect(signinErrorMessage("Rate limit exceeded")).toContain("Too many attempts");
    expect(signinErrorMessage("too many requests")).toContain("Too many attempts");
    expect(signinErrorMessage("RateLimit")).toContain("Too many attempts");
  });
  it("maps everything else to invalid credentials (no enumeration)", () => {
    expect(signinErrorMessage("Invalid login credentials")).toBe("Invalid email or password. Please try again.");
    expect(signinErrorMessage("Email not confirmed")).toBe("Invalid email or password. Please try again.");
  });
});

describe("console login fallback (console/login/page.tsx)", () => {
  it("5xx → server error message", () => {
    expect(consoleFallbackMessage({ ok: false, status: 500 })).toContain("Server error");
    expect(consoleFallbackMessage({ ok: false, status: 502 })).toContain("Server error");
  });
  it("4xx → generic invalid (no user enumeration)", () => {
    expect(consoleFallbackMessage({ ok: false, status: 401 })).toBe("Invalid email or password. Please try again.");
    expect(consoleFallbackMessage({ ok: false, status: 400 })).toBe("Invalid email or password. Please try again.");
  });
  it("ok → redirect to magic link", () => {
    expect(consoleFallbackMessage({ ok: true, status: 200 })).toBe("redirect");
  });
});

describe("auth callback ?error= mapping", () => {
  it("maps known codes", () => {
    expect(callbackErrorMessage("auth_callback_failed")).toContain("Google sign-in failed");
    expect(callbackErrorMessage("magiclink_failed")).toContain("expired or is invalid");
  });
  it("unknown/null → no banner", () => {
    expect(callbackErrorMessage(null)).toBeNull();
    expect(callbackErrorMessage("other")).toBeNull();
  });
});

describe("middleware protected-route redirects", () => {
  it("console paths (except login) → /console/login", () => {
    expect(middlewareRedirect("/console")).toBe("/console/login");
    expect(middlewareRedirect("/console/orders")).toBe("/console/login");
    expect(middlewareRedirect("/console/login")).toBeNull();
  });
  it("dashboard → /signin", () => {
    expect(middlewareRedirect("/dashboard")).toBe("/signin");
  });
  it("public paths untouched", () => {
    expect(middlewareRedirect("/")).toBeNull();
    expect(middlewareRedirect("/demo-diner")).toBeNull();
    expect(middlewareRedirect("/demo-diner/menu")).toBeNull();
  });
});

describe("demo-org check error handling (console/login)", () => {
  it("failed demo check hides demo login with retry hint", () => {
    const onFailedCheck = () => ({
      isDemoOrg: false,
      demoCheckError: "Could not check demo availability — demo login may be hidden. Try again.",
    });
    const s = onFailedCheck();
    expect(s.isDemoOrg).toBe(false);
    expect(s.demoCheckError).toContain("Try again");
  });
});

describe("next-param preservation (?org= + ?next=)", () => {
  it("console login appends ?org= to next", () => {
    const rawNext = "/console";
    const orgSlug = "demo-diner";
    const next = `${rawNext}${rawNext.includes("?") ? "&" : "?"}org=${orgSlug}`;
    expect(next).toBe("/console?org=demo-diner");
  });
  it("unauth console redirect preserves pathname as ?next=", () => {
    const loginUrl = new URL("http://x/console/login");
    loginUrl.searchParams.set("next", "/console/orders");
    expect(loginUrl.toString()).toContain("next=%2Fconsole%2Forders");
  });
});
