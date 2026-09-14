import { NextResponse } from "next/server";

const DEFAULT_AGNES_IMAGE_URL = "https://apihub.agnes-ai.com/v1/images/generations";

export async function POST(req: Request) {
  const { prompt, imageBase64 } = await req.json();

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const apiKey = process.env.AGNES_API_KEY;
  const imageUrl = process.env.AGNES_IMAGE_API_URL?.trim() || DEFAULT_AGNES_IMAGE_URL;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing AGNES_API_KEY" },
      { status: 500 },
    );
  }

  const body: Record<string, unknown> = {
    model: "agnes-image-2.5-flash",
    prompt,
    size: "1K",
    ratio: "16:9",
    extra_body: {
      response_format: "url",
    },
  };

  if (imageBase64) {
    (body.extra_body as Record<string, unknown>).image = [imageBase64];
  }

  try {
    const res = await fetch(imageUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? data.error ?? "API request failed" },
        { status: res.status },
      );
    }

    const url = data.data?.[0]?.url ?? null;
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 500 });
  }
}

