import { NextResponse } from "next/server";

const TARGET_EMAIL = "tablecraft8@gmail.com";

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    console.log(`[Contact Form Submission] To: ${TARGET_EMAIL} | From: ${name} (${email}) | Message: ${message}`);

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
          reply_to: email,
          subject: `Tablecraft Inquiry from ${name}`,
          text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Resend email delivery failed:", errorData);
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