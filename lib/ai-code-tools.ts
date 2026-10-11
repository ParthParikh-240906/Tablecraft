/**
 * lib/ai-code-tools.ts
 * Whitelisted file access for AI combine/edit flows.
 * Models propose unified diffs with exact file:line references; routes apply them.
 */
import fs from "node:fs/promises";
import path from "node:path";

const WORKSPACE = process.cwd();

const ALLOWED_PREFIXES = [
  "app/",
  "components/",
  "lib/",
  "types/",
  "public/",
];

const ALLOWED_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".sql", ".md",
]);

function safePath(rel: string): string {
  const normalized = path.normalize(rel).replace(/^\/+/, "");
  if (normalized.includes("..")) throw new Error("Path traversal blocked");
  if (!ALLOWED_PREFIXES.some((p) => normalized.startsWith(p))) {
    throw new Error(`Path not whitelisted: ${rel}`);
  }
  const ext = path.extname(normalized);
  if (ext && !ALLOWED_EXT.has(ext)) throw new Error(`Extension not allowed: ${ext}`);
  return path.join(WORKSPACE, normalized);
}

export async function aiReadFile(rel: string, maxChars = 20000): Promise<{ path: string; content: string }> {
  const abs = safePath(rel);
  const content = await fs.readFile(abs, "utf8");
  return { path: rel, content: content.slice(0, maxChars) };
}

export type FilePatch = {
  path: string;
  /** Unified diff or full new content */
  diff?: string;
  content?: string;
  lines?: string;
};

export function assertPatches(patches: FilePatch[]): void {
  if (!Array.isArray(patches) || patches.length === 0) throw new Error("No patches provided");
  if (patches.length > 20) throw new Error("Too many files in one edit (max 20)");
  for (const p of patches) {
    if (!p.path || (!p.diff && !p.content)) throw new Error(`Invalid patch for ${p.path}`);
    safePath(p.path);
  }
}

/** Pinpoint helper: find line numbers containing a needle. */
export async function pinpoint(
  rel: string,
  needle: string,
): Promise<Array<{ line: number; text: string }>> {
  const { content } = await aiReadFile(rel, 200000);
  const lines = content.split("\n");
  const out: Array<{ line: number; text: string }> = [];
  const q = needle.toLowerCase();
  lines.forEach((text, i) => {
    if (text.toLowerCase().includes(q)) out.push({ line: i + 1, text: text.slice(0, 200) });
  });
  return out.slice(0, 50);
}
