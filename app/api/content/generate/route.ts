import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a creative copywriter for a restaurant SaaS platform called Tablecraft.

Given a short description of a restaurant, generate:
1. A tagline: one compelling line, max 60 characters, no quotes.
2. An about paragraph: 3-4 sentences warm and inviting, describing the restaurant's vibe, cuisine, and story. No intro fluff like "Welcome to..." — just describe it directly.

Return ONLY valid JSON, nothing else:
{"tagline": "...", "about": "..."}`;

export async function POST(request: Request) {
  let body: { description?: string; orgName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { description, orgName } = body;
  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const apiKey = process.env.OMNI_API_KEY;
  const baseUrl = process.env.OMNI_BASE_URL;
  if (!apiKey || !baseUrl) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const userPrompt = orgName
    ? `Restaurant name: ${orgName}. Description: ${description.trim()}`
    : `Description: ${description.trim()}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "Chatbot",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[CONTENT GENERATE] API failed:", res.status, errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "AI returned no content" }, { status: 500 });

    const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonMatch) return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });

    const result = JSON.parse(jsonMatch);
    return NextResponse.json({
      tagline: String(result.tagline ?? "").trim(),
      about: String(result.about ?? "").trim(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CONTENT GENERATE] Failed:", message);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
