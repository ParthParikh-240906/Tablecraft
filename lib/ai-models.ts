/**
 * lib/ai-models.ts
 * Central router for Tablecraft AI models.
 *
 * - Haiku 5.5 via CLAUDE_API — build (medium effort) + chatbot/scan/vision (low)
 *   POST https://api.anthropic.com/v1/messages
 *   { model: "claude-haiku-5-5", output_config: { effort: "low"|"medium" } }
 * - GPT 6.1 Sol via OPENAI_API — combine (high effort) + edit (medium effort)
 *   POST https://api.openai.com/v1/responses
 *   { model: "gpt-6.1-sol", reasoning: { effort: "high"|"medium" } }
 *   Responses API is required for tool calling (Chat Completions has no tools
 *   for this model). We use it without tools for plain text, with the same shape.
 * - Image generation via OpenAI Images API (GPT Image 2.5) with OPENAI_API —
 *   POST {IMAGE_API base}/images/generations { model: "gpt-image-2.5-flare", prompt, size, n }
 *   IMAGE_API is an optional base-URL override (defaults to https://api.openai.com/v1).
 */

export const HAIKU_MODEL = "claude-haiku-5-5";
export const GPT_SOL_MODEL = "gpt-6.1-sol";
export const IMAGE_MODEL = "gpt-image-2.5-flare";

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
  // Optional base-URL override; defaults to OpenAI. Accepts a base URL
  // (https://api.openai.com/v1) or a full .../images/generations endpoint.
  const raw = (process.env.IMAGE_API || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  if (raw.endsWith("/images/generations")) return raw;
  if (raw.endsWith("/v1")) return `${raw}/images/generations`;
  return `${raw}/images/generations`;
}

export type HaikuMeta = {
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type HaikuOpts = {
  maxTokens?: number;
  system?: string;
  effort?: "low" | "medium" | "high";
  images?: Array<{ mediaType: string; data: string }>;
  /**
   * Disable thinking blocks. Thinking is ON by default and counts toward
   * max_tokens — for long-form generation / small-budget JSON extraction the
   * model can burn the whole budget thinking and return zero text.
   */
  disableThinking?: boolean;
  /** Optional callback receiving stop reason + token usage (for logging). */
  onMeta?: (m: HaikuMeta) => void;
};

/**
 * Call Haiku 5.5. Returns display text.
 * `effort` defaults to low; build uses medium.
 * Pass `images` (base64 data + media type) for vision tasks.
 */
export async function callHaikuLow(prompt: string, opts: HaikuOpts = {}): Promise<string> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const img of opts.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
    });
  }
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
      output_config: { effort: opts.effort ?? "low" },
      ...(opts.disableThinking ? { thinking: { type: "disabled" } } : {}),
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Haiku 5.5 request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  opts.onMeta?.({
    stopReason: data.stop_reason,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[Haiku 5.5] stop=${data.stop_reason ?? "?"} ` +
        `in=${data.usage?.input_tokens ?? "?"} out=${data.usage?.output_tokens ?? "?"} ` +
        `blocks=${(data.content ?? []).map((b) => b.type).join(",") || "(none)"}`,
    );
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
  if (!text.trim()) {
    throw new Error(`Haiku 5.5 returned no text (stop_reason: ${data.stop_reason ?? "unknown"})`);
  }
  return text;
}

export type GptSolOpts = {
  maxOutputTokens?: number;
  system?: string;
  effort?: "low" | "medium" | "high";
};

/**
 * Call GPT 6.1 Sol via Responses API. Returns output text.
 * Uses `input` array shape; `reasoning.effort` defaults to high.
 * Uses it without tools for plain text, with the same shape.
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
      reasoning: { effort: opts.effort ?? "high" },
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
 * Generate an image via the OpenAI Images API (GPT Image 2.5) using OPENAI_API.
 * Returns the first image URL (or b64 data URL — GPT image models always
 * return base64).
 */
export async function callImageGen(
  prompt: string,
  opts: ImageGenOpts = {},
): Promise<string> {
  const res = await fetch(imageBase(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiKey()}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
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
