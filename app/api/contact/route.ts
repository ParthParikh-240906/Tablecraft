import { NextResponse } from "next/server";

const TARGET_EMAIL = "parth.kaushik.parikh@gmail.com";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    const { name, email, message } = (body ?? {}) as { name?: unknown; email?: unknown; message?: unknown };

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return NextResponse.json(
        { error: "Name must be 2–100 characters." },
        { status: 400 }
      );
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }
    if (typeof message !== "string" || message.trim().length < 10 || message.trim().length > 5000) {
      return NextResponse.json(
        { error: "Message must be 10–5000 characters." },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMessage = message.trim();

    console.log(`[Contact Form Submission] To: ${TARGET_EMAIL} | From: ${cleanName} (${cleanEmail}) | Message: ${cleanMessage.slice(0, 200)}`);

    // If RESEND_API_KEY is configured, send the real email via Resend REST API
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Tablecraft Contact <onboarding@resend.dev>",
          to: [TARGET_EMAIL],
          reply_to: cleanEmail,
          subject: `Tablecraft Inquiry from ${cleanName}`.slice(0, 120),
          text: `Name: ${cleanName}\nEmail: ${cleanEmail}\n\nMessage:\n${cleanMessage}`,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Resend email delivery failed:", errorData);
        return NextResponse.json(
          { error: "Could not deliver your message. Please try again later." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Message received successfully.",
    });
  } catch (err: any) {
    console.error("Error in contact route:", err);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 }
    );
  }
}