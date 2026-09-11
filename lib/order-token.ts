import { createHmac, timingSafeEqual } from "crypto";

/**
 * Server-only helpers for signing order-confirmation URLs.
 *
 * We don't encrypt the order details — we SIGN the URL. An HMAC-SHA256 of the
 * order id proves this exact URL was issued by us (in the Stripe success_url),
 * so a stranger who guesses or scrapes an order UUID still can't view the
 * receipt, even though the page itself is public (no login required).
 *
 * No extra npm package needed: Node's built-in crypto does the job.
 *
 * The HMAC key comes from ORDER_VIEW_SECRET, falling back to the service-role
 * key so it works out of the box in dev and on Vercel. If you rotate the
 * service-role key later, set ORDER_VIEW_SECRET to keep old order links valid.
 */

function hmacKey(): string {
  return (
    process.env.ORDER_VIEW_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

export function signOrderToken(orderId: string): string {
  return createHmac("sha256", hmacKey()).update(orderId).digest("hex");
}

export function verifyOrderToken(
  orderId: string,
  token: string | null | undefined,
): boolean {
  if (!token || !hmacKey()) return false;
  try {
    const expected = Buffer.from(signOrderToken(orderId), "utf8");
    const received = Buffer.from(token, "utf8");
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}