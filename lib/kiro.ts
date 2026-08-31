/**
 * Server-side client for calling OmniRoute's Kiro-frontend model.
 * 
 * Kiro-frontend is an OmniRoute route (primary: opencode/mimo-v2.5-free,
 * backup: mistral/mistral-medium-3-5) exposed at the same OpenAI-compatible
 * endpoint the main Hermes model uses.
 */

const BASE_URL = process.env.OMNI_BASE_URL || "http://localhost:20128/v1";
const API_KEY = process.env.OMNI_API_KEY || "";

export interface KiroMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface KiroResult {
  content: string;
  model: string;
  raw: any;
}

/**
 * Call Kiro-frontend with a chat completion request.
 * Returns the assistant's text content.
 */
export async function callKiroFrontend(params: {
  system: string;
  user: string;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<KiroResult> {
  const { system, user, temperature = 0.7, jsonMode = false } = params;

  const messages: KiroMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const body: Record<string, unknown> = {
    model: "Kiro-frontend",
    messages,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    // Subagent generation can take a while (elaboration + preview HTML)
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Kiro-frontend request failed (${res.status}): ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const model = data?.model ?? "Kiro-frontend";

  return { content, model, raw: data };
}

/**
 * Safely parse JSON out of a model response that may contain
 * markdown fences or leading/trailing prose.
 */
export function parseKiroJson<T>(content: string): T {
  // Strip markdown code fences
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : content;

  // Find the first { ... } balanced block
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
