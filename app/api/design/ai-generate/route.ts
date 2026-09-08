import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt, imageBase64 } = await req.json();

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const apiKey = process.env.AGNES_API_KEY;
  const baseUrl = process.env.AGNES_BASE_URL;

  if (!apiKey || !baseUrl) {
    return NextResponse.json(
      { error: "Missing AGNES_API_KEY or AGNES_BASE_URL" },
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
    const res = await fetch(`${baseUrl}/images/generations`, {
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
