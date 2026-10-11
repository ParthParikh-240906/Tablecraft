/**
 * lib/ai-models.ts
 * Central router for Tablecraft AI models.
 *
 * - Haiku 5.5 (low reasoning effort) via CLAUDE_API — creation + chatbot
 *   POST https://api.anthropic.com/v1/messages
 *   { model: "claude-haiku-5-5", output_config: { effort: "low" } }
 * - GPT 6.1 Sol (high effort) via OPENAI_API — combine + edit (code read/write)
 *   POST https://api.openai.com/v1/responses
 *   { model: "gpt-6.1-sol", reasoning: { effort: "high" } }
 *   Responses API is required for tool calling (Chat Completions has no tools
 *   for this model). We use it without tools for plain text, with the same shape.
 * - Image generation via IMAGE_API (OpenAI-compatible images endpoint base URL)
 */

export const HAIKU_MODEL = "claude-haiku-5-5";
export const GPT_SOL_MODEL = "gpt-6.1-sol";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function claudeKey(): string {
  const k = process.env.CLAUDE_API;
  if (!k) throw new Error("CLAUDE_API is not configured");
  return k;
}

function openaiKey(): string {
  const k = process.env.OPENAI_API;
  if (!k) throw new Error("OPENAI_API is not configured");
  return k;
}

function imageBase(): string {
  // IMAGE_API may be a full endpoint or a base URL. Normalise to .../images/generations
  const raw = process.env.IMAGE_API;
  if (!raw) throw new Error("IMAGE_API is not configured");
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.endsWith("/images/generations")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/images/generations`;
  return `${trimmed}/images/generations`;
}

export type HaikuOpts = {
  maxTokens?: number;
  system?: string;
};

/**
 * Call Haiku 5.5 at low effort. Returns display text.
 */
export async function callHaikuLow(prompt: string, opts: HaikuOpts = {}): Promise<string> {
  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": claudeKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      output_config: { effort: "low" },
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Haiku 5.5 request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
  return text;
}

export type GptSolOpts = {
  maxOutputTokens?: number;
  system?: string;
};

/**
 * Call GPT 6.1 Sol at high effort via Responses API. Returns output text.
 * Uses `input` array shape; `reasoning.effort: high`.
 */
export async function callGptSolHigh(prompt: string, opts: GptSolOpts = {}): Promise<string> {
  const input: Array<Record<string, unknown>> = [];
  if (opts.system) {
    input.push({
      type: "message",
      role: "system",
      content: [{ type: "input_text", text: opts.system }],
    });
  }
  input.push({
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: prompt }],
  });
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiKey()}`,
    },
    body: JSON.stringify({
      model: GPT_SOL_MODEL,
      reasoning: { effort: "high" },
      input,
      store: false,
      ...(opts.maxOutputTokens ? { max_output_tokens: opts.maxOutputTokens } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GPT 6.1 Sol request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    output_text?: string;
  };
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.text) parts.push(c.text);
    }
  }
  return parts.join("\n");
}

export type ImageGenOpts = {
  size?: string;
  n?: number;
};

/**
 * Generate an image via IMAGE_API (OpenAI-compatible).
 * Returns the first image URL (or b64 data URL when b64_json).
 */
export async function callImageGen(
  prompt: string,
  opts: ImageGenOpts = {},
): Promise<string> {
  const res = await fetch(imageBase(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.IMAGE_API}`,
    },
    body: JSON.stringify({
      prompt,
      size: opts.size ?? "1024x1024",
      n: opts.n ?? 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image generation failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const first = data.data?.[0];
  if (!first) throw new Error("Image generation returned no data");
  if (first.url) return first.url;
  if (first.b64_json) return `data:image/png;base64,${first.b64_json}`;
  throw new Error("Image generation returned unusable payload");
}
