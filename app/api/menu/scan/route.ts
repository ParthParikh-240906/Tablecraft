import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_ITEMS = 500;
const MAX_NAME_LEN = 200;
const MAX_DESC_LEN = 500;
const MAX_CATEGORY_LEN = 100;

/**
 * POST /api/menu/scan
 * Upload a PDF or image, extract text, parse into menu items, save to DB.
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  let tmpPath: string | null = null;
  try {
    const file = formData.get("file") as File | null;
    const orgId = formData.get("orgId") as string | null;
    const mode = formData.get("mode") as "append" | "replace";

    if (!file || !orgId) {
      return NextResponse.json(
        { error: "Missing file or orgId" },
        { status: 400 }
      );
    }

    if (typeof orgId !== "string" || !UUID_RE.test(orgId)) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(orgId);
    if ("response" in auth) return auth.response;

    // AI quota brake: 10 scans/day per org (monthly plan quotas in lib/rate-limit.ts).
    const orgRl = rateLimit(`menu-scan:org:${orgId}`, 10, 24 * 60 * 60 * 1000);
    if (!orgRl.allowed) return rateLimitedResponse(orgRl.resetMs);
    const ipRl = rateLimit(`menu-scan:ip:${getClientIp(request)}`, 10, 24 * 60 * 60 * 1000);
    if (!ipRl.allowed) return rateLimitedResponse(ipRl.resetMs);

    if (mode !== "append" && mode !== "replace") {
      return NextResponse.json(
        { error: "mode must be 'append' or 'replace'" },
        { status: 400 }
      );
    }

    if (typeof file.size === "number" && file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    // Save temp file
    const ext = path.extname(file.name ?? "").toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: "Only PDF or image files are supported (PDF, JPG, PNG, WebP)" },
        { status: 400 }
      );
    }
    // Save temp file to the OS temp dir (serverless-safe; process.cwd() is read-only on Vercel).
    const tmpPathInner = path.join(os.tmpdir(), `menu-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    tmpPath = tmpPathInner;
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }
    await fs.writeFile(tmpPathInner, Buffer.from(bytes));

    try {
      // Run Python OCR script. python3 may not exist on serverless (Vercel) —
      // fail with 501 and a clear message instead of a generic 500.
      const pythonOutput = await new Promise<string>((resolve, reject) => {
        const proc = spawn("python3", [path.join(process.cwd(), "scripts/extract-menu.py"), tmpPathInner]);
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (data: Buffer) => (stdout += data.toString()));
        proc.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
        proc.on("close", (code) => {
          if (code !== 0) reject(new Error(`Python script failed (code ${code}): ${stderr}`));
          else resolve(stdout.trim());
        });
        proc.on("error", (err: NodeJS.ErrnoException) => reject(err));
      }).catch((err: NodeJS.ErrnoException) => {
        if (err?.code === "ENOENT" || /ENOENT/i.test(String((err as Error)?.message ?? ""))) {
          throw Object.assign(new Error("MENU_SCAN_UNAVAILABLE"), { status: 501 });
        }
        throw err;
      });

      // Parse extracted text
      let extracted: { pages: Array<{ page_index: number; text: string; source: string }>; error?: string };
      try {
        extracted = JSON.parse(pythonOutput);
      } catch {
        return NextResponse.json(
          { error: "Failed to parse OCR output" },
          { status: 500 }
        );
      }

      if (extracted.error) {
        console.error("[MENU SCAN] OCR extraction failed");
        return NextResponse.json({ error: "Could not extract text from the file" }, { status: 500 });
      }

      // Combine all page text
      const rawText = extracted.pages
        .map((p) => p.text)
        .filter((t) => t && !t.startsWith("["))
        .join("\n\n");

      if (process.env.NODE_ENV === "development") {
        console.log("[MENU SCAN] OCR text length:", rawText.length);
      }

      if (!rawText.trim()) {
        return NextResponse.json(
          { error: "No text could be extracted from the file" },
          { status: 400 }
        );
      }

      // Call LLM to parse into structured menu items
      const llmResult = await callLLM(rawText);
      const menuItems = llmResult.items as Array<{
        name: string;
        description?: string;
        price: number;
        category?: string;
      }>;

      if (!Array.isArray(menuItems) || menuItems.length === 0) {
        return NextResponse.json(
          { error: "LLM returned no menu items" },
          { status: 500 }
        );
      }

      // Filter out items without prices (required by DB)
      const validItems = menuItems.filter((item: any) => item.price != null && typeof item.name === "string" && item.name.trim());
      if (validItems.length === 0) {
        return NextResponse.json(
          { error: "No valid menu items could be extracted" },
          { status: 500 }
        );
      }
      if (validItems.length > MAX_ITEMS) {
        return NextResponse.json({ error: "Too many menu items extracted" }, { status: 400 });
      }

      // Insert into DB
      // NOTE: replace mode is delete-then-insert (not atomic). If the insert
      // fails after the delete, the menu is left empty — the CRITICAL log
      // below is the signal to restore from backup.
      const supabase = createAdminClient();
      const didReplaceDelete = mode === "replace";
      if (mode === "replace") {
        const { error: deleteError } = await supabase.from("menu_items").delete().eq("org_id", orgId);
        if (deleteError) {
          console.error("[MENU SCAN] Delete error:", deleteError);
          return NextResponse.json(
            { error: "Could not save menu items. Please try again." },
            { status: 500 }
          );
        }
      }

      const rows = validItems.slice(0, MAX_ITEMS).map((item) => ({
        org_id: orgId,
        name: String(item.name).slice(0, MAX_NAME_LEN),
        description: typeof item.description === "string" ? item.description.slice(0, MAX_DESC_LEN) : null,
        price: Number(item.price),
        category: typeof item.category === "string" ? item.category.slice(0, MAX_CATEGORY_LEN) : null,
        available: true,
      }));

      const { error: insertError } = await supabase
        .from("menu_items")
        .insert(rows);

      if (insertError) {
        console.error("[MENU SCAN] Insert error:", insertError);
        if (didReplaceDelete) {
          console.error("[MENU SCAN] CRITICAL: replace-mode delete succeeded but insert failed — menu left empty for org", orgId);
        }
        return NextResponse.json(
          { error: "Could not save menu items. Please try again." },
          { status: 500 }
        );
      }

      // Temp file cleanup is handled by the finally block below.
      return NextResponse.json({
        success: true,
        itemCount: rows.length,
        mode,
      });
    } catch (err) {
      if ((err as Error)?.message === "MENU_SCAN_UNAVAILABLE" || (err as { status?: number })?.status === 501) {
        return NextResponse.json(
          { error: "Menu scan unavailable in this environment – please add items manually" },
          { status: 501 },
        );
      }
      console.error("[MENU SCAN] Error:", err);
      return NextResponse.json(
        { error: "Could not process the menu file. Please try again." },
        { status: 500 }
      );
    } finally {
      if (tmpPath) await fs.unlink(tmpPath).catch(() => {});
    }
  } catch (err) {
    if (tmpPath) await fs.unlink(tmpPath).catch(() => {});
    console.error("[MENU SCAN] unhandled:", err);
    return NextResponse.json(
      { error: "Could not process the menu file. Please try again." },
      { status: 500 }
    );
  }
}

async function callLLM(rawText: string): Promise<any> {
  const apiKey = process.env.AGNES_API_KEY;

  if (!apiKey) {
    throw new Error("AGNES_API_KEY not configured");
  }

  const prompt = `You are a restaurant menu parser. Extract ALL menu items from the following text.

IMPORTANT: Prices are formatted with dotted leaders like "Capuccino ............. 18" or "Iced Latte ............ 19". Extract the NUMBER at the end of each line as the price.

Return ONLY valid JSON with this structure:
{
  "items": [
    {"name": "item name", "description": "optional description", "price": 45, "category": "Category Name"}
  ]
}

Rules:
- Every item MUST have a "price" field as a number (the digits from the menu)
- Category helps organize items (e.g., "Starters", "Mains", "Drinks", "Hot Drinks", "Iced Drinks")
- If no category is obvious, use "General"
- Extract ALL items you can find
- Return ONLY JSON, no other text

Raw text:
${rawText}`;

  const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "agnes-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[LLM] Error response:", response.status, errText.slice(0, 500));
    throw new Error("LLM call failed");
  }

  const data = await response.json();
  if (process.env.NODE_ENV === "development") {
    console.log("[LLM] Response length:", JSON.stringify(data).length);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned no content");

  // Parse JSON from response (may be wrapped in markdown code block)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("LLM did not return JSON");

  return JSON.parse(jsonMatch[0]);
}
