/**
 * Tolerant JSON extraction for model responses.
 *
 * Models are asked to return JSON only, but occasionally wrap it in markdown
 * fences or add a sentence before/after. This helper strips fences and finds
 * the first balanced object/array. Returns null instead of throwing.
 */
export function parseModelJson<T = unknown>(text: string): T | null {
  if (!text || typeof text !== "string") return null;

  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();

  const start = firstJsonStart(s);
  if (start < 0) return null;

  const candidate = takeBalanced(s, start);
  if (!candidate) return null;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // One more try: remove trailing commas before closing braces/brackets.
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1")) as T;
    } catch {
      return null;
    }
  }
}

function firstJsonStart(s: string): number {
  const obj = s.indexOf("{");
  const arr = s.indexOf("[");
  if (obj < 0) return arr;
  if (arr < 0) return obj;
  return Math.min(obj, arr);
}

function takeBalanced(s: string, start: number): string | null {
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  return null;
}
