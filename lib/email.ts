/**
 * lib/email.ts — shared Resend email helper.
 *
 * Reuses the same RESEND_API_KEY already used for the contact inquiry form
 * (app/api/contact/route.ts). No new SDK — raw fetch to https://api.resend.com/emails,
 * so no package.json changes are needed.
 *
 * IMPORTANT for Gmail delivery (from Resend docs):
 * - `onboarding@resend.dev` is a test sender. It reliably delivers to the
 *   Resend account owner's own address and to `delivered@resend.dev`, but
 *   arbitrary Gmail recipients will bounce / go to spam until you verify
 *   your own domain in Resend (Domains → Add domain → DNS records) and set
 *   RESEND_FROM_EMAIL="Tablecraft <noreply@yourdomain.com>".
 * - Resend free tier: ~100 emails/day, ~10/sec.
 */

export function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY ?? "",
    from:
      process.env.RESEND_FROM_EMAIL?.trim() ||
      "Tablecraft <onboarding@resend.dev>",
  };
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; skipped?: boolean; id?: string; error?: string }> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[email:skipped:no-key] to=${Array.isArray(opts.to) ? opts.to.join(",") : opts.to} subject=${opts.subject}`);
    }
    return { ok: true, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject.slice(0, 120),
        text: opts.text.slice(0, 10000),
        ...(opts.html ? { html: opts.html } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Resend delivery failed:", err);
      return { ok: false, error: "delivery-failed" };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("Resend send error:", err);
    return { ok: false, error: "send-error" };
  }
}

export function sendQuotaWarningEmail(
  toEmail: string,
  category: string,
  used: number,
  limit: number,
) {
  const pct = Math.round((used / Math.max(1, limit)) * 100);
  const text = [
    `You've used ${used}/${limit} (${pct}%) of your ${category} quota this month.`,
    ``,
    `At 100% further requests will be blocked until next month or an upgrade.`,
    `Upgrade to Pro/Max from your dashboard to raise limits.`,
  ].join("\n");
  return sendEmail({
    to: toEmail,
    subject: `Tablecraft: 75% ${category} usage reached (${used}/${limit})`,
    text,
  });
}

