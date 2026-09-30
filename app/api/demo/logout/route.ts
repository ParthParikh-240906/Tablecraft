import { NextResponse } from "next/server";

/**
 * POST /api/demo/logout
 *
 * Clears the demo_session cookie and any associated snapshot data.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("demo_session", "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}
