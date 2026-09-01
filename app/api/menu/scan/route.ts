import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/menu/scan
 * Upload a PDF or image, extract text, parse into menu items, save to DB.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const orgId = formData.get("orgId") as string;
    const mode = formData.get("mode") as "append" | "replace";

    if (!file || !orgId) {
      return NextResponse.json(
        { error: "Missing file or orgId" },
        { status: 400 }
      );
    }

    if (mode !== "append" && mode !== "replace") {
      return NextResponse.json(
        { error: "mode must be 'append' or 'replace'" },
        { status: 400 }
      );
    }

    // Save temp file
    const ext = path.extname(file.name).toLowerCase();
    const tmpDir = path.join(process.cwd(), ".tmp");
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `menu-upload-${Date.now()}${ext}`);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(tmpPath, Buffer.from(bytes));

    try {
      // Run Python OCR script
      const pythonOutput = await new Promise<string>((resolve, reject) => {
        const proc = spawn("python3", [path.join(process.cwd(), "scripts/extract-menu.py"), tmpPath]);
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (data: Buffer) => (stdout += data.toString()));
        proc.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
        proc.on("close", (code) => {
          if (code !== 0) reject(new Error(`Python script failed (code ${code}): ${stderr}`));
          else resolve(stdout.trim());
        });
        proc.on("error", (err) => reject(err));
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
        return NextResponse.json({ error: extracted.error }, { status: 500 });
      }

      // Combine all page text
      const rawText = extracted.pages
        .map((p) => p.text)
        .filter((t) => t && !t.startsWith("["))
        .join("\n\n");

      console.log("[MENU SCAN] Raw OCR text:", rawText.slice(0, 2000));

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
      const validItems = menuItems.filter((item: any) => item.price != null);
      if (validItems.length === 0) {
        return NextResponse.json(
          { error: "LLM returned items but none have prices" },
          { status: 500 }
        );
      }

      // Insert into DB
      const supabase = createAdminClient();
      if (mode === "replace") {
        await supabase.from("menu_items").delete().eq("org_id", orgId);
      }

      const rows = menuItems.map((item) => ({
        org_id: orgId,
        name: item.name,
        description: item.description || null,
        price: item.price,
        category: item.category || null,
        available: true,
      }));

      const { error: insertError } = await supabase
        .from("menu_items")
        .insert(rows);

      if (insertError) {
        console.error("[MENU SCAN] Insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to save menu items" },
          { status: 500 }
        );
      }

      // Cleanup temp file
      await fs.unlink(tmpPath).catch(() => {});

      return NextResponse.json({
        success: true,
        itemCount: rows.length,
        mode,
      });
    } catch (err: any) {
      // Cleanup on error
      await fs.unlink(tmpPath).catch(() => {});
      console.error("[MENU SCAN] Error:", err);
      return NextResponse.json(
        { error: err.message || "Failed to process file" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Invalid request" },
      { status: 400 }
    );
  }
}

async function callLLM(rawText: string): Promise<any> {
  const apiKey = process.env.OMNI_API_KEY;
  const baseUrl = process.env.OMNI_BASE_URL;

  if (!apiKey || !baseUrl) {
    throw new Error("OMNI_API_KEY or OMNI_BASE_URL not configured");
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

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "hermes",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[LLM] Error response:", response.status, errText);
    throw new Error(`LLM call failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  console.log("[LLM] Response:", JSON.stringify(data).slice(0, 500));
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned no content");

  // Parse JSON from response (may be wrapped in markdown code block)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("LLM did not return JSON");

  return JSON.parse(jsonMatch[0]);
}
