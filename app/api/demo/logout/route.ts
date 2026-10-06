import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * POST /api/demo/logout
 *
 * Clears the demo_session cookie and any associated snapshot data.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`demo:${getClientIp(request)}`, 20, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  const response = NextResponse.json({ success: true });
  response.cookies.set("demo_session", "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}
