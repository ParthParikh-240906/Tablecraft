import { NextResponse } from "next/server";

const DEFAULT_AGNES_IMAGE_URL = "https://apihub.agnes-ai.com/v1/images/generations";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { prompt, imageBase64 } = (body ?? {}) as { prompt?: unknown; imageBase64?: unknown };

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: "prompt must be under 1000 characters" }, { status: 400 });
    }
    if (imageBase64 !== undefined && (typeof imageBase64 !== "string" || imageBase64.length > 7_000_000)) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }

  const apiKey = process.env.AGNES_API_KEY;
  const imageUrl = process.env.AGNES_IMAGE_API_URL?.trim() || DEFAULT_AGNES_IMAGE_URL;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing AGNES_API_KEY" },
      { status: 500 },
    );
  }

  const payload: Record<string, unknown> = {
    model: "agnes-image-2.5-flash",
    prompt: (prompt as string).trim().slice(0, 1000),
    size: "1K",
    ratio: "16:9",
    extra_body: {
      response_format: "url",
    },
  };

  if (imageBase64) {
    (payload.extra_body as Record<string, unknown>).image = [imageBase64];
  }

    const res = await fetch(imageUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      console.error("[AI GENERATE] Image API returned non-JSON");
      return NextResponse.json({ error: "Image service error. Please try again." }, { status: 502 });
    }

    if (!res.ok) {
      console.error("[AI GENERATE] Image API failed:", res.status);
      return NextResponse.json(
        { error: "Could not generate the image. Please try again." },
        { status: 502 },
      );
    }

    const url = data.data?.[0]?.url ?? null;
    if (typeof url !== "string") {
      return NextResponse.json({ error: "Could not generate the image. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[AI GENERATE] unhandled:", err);
    return NextResponse.json({ error: "Could not generate the image. Please try again." }, { status: 500 });
  }
}

