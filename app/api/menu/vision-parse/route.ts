import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

const COMPRESSION_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 1920;

/**
 * POST /api/menu/vision-parse
 * Upload a menu image → Gemini vision extracts items → save to DB.
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

    // Validate image type
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
      return NextResponse.json(
        { error: "Only image files are supported (JPG, PNG, WebP)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const fileSize = bytes.byteLength;

    // Compress if over threshold
    let finalBuffer: Buffer = Buffer.from(bytes);
    if (fileSize > COMPRESSION_THRESHOLD) {
      console.log(`[VISION PARSE] Compressing ${fileSize / 1024 / 1024}MB image...`);
      finalBuffer = await compressImage(finalBuffer, ext || "jpg");
      console.log(`[VISION PARSE] Compressed to ${finalBuffer.length / 1024}KB`);
    }

    // Convert to base64
    const base64 = finalBuffer.toString("base64");
    const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;

    // Call OmniRoute
    const apiKey = process.env.OMNI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OMNI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.OMNI_BASE_URL || "http://localhost:20128/v1";

    const prompt = `You are a restaurant menu parser. Extract ALL menu items from this image.

Format: Each item has a name and a price (number). Items may have dotted leaders connecting name to price like "Capuccino ............. 18".

Return ONLY valid JSON with this exact structure:
{
  "items": [
    {"name": "item name", "description": "optional description", "price": 18, "category": "Hot Drinks"}
  ]
}

Rules:
- Every item MUST have a numeric "price" field
- Category should match section headers (e.g., "Hot Drinks", "Iced Drinks", "Juices", "Starters", "Mains")
- Extract ALL items visible in the menu
- Return ONLY JSON, no other text`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "Menu",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[VISION PARSE] Gemini error:", response.status, errText);
      return NextResponse.json(
        { error: `OmniRoute API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "OmniRoute returned no content" },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let parsed: { items: Array<{ name: string; description?: string; price: number; category?: string }> };
    try {
      // Strip markdown code blocks if present
      const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0];
      parsed = JSON.parse(jsonMatch ?? content);
    } catch {
      console.error("[VISION PARSE] JSON parse failed:", content);
      return NextResponse.json(
        { error: "Failed to parse OmniRoute response" },
        { status: 500 }
      );
    }

    const menuItems = parsed.items;
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return NextResponse.json(
        { error: "No menu items found in image" },
        { status: 400 }
      );
    }

    // Filter out items without prices
    const validItems = menuItems.filter(
      (item) => item.price != null && typeof item.price === "number"
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "Extracted items but none have prices" },
        { status: 500 }
      );
    }

    // Insert into DB
    const supabase = createAdminClient();
    if (mode === "replace") {
      await supabase.from("menu_items").delete().eq("org_id", orgId);
    }

    const rows = validItems.map((item) => ({
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
      console.error("[VISION PARSE] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save menu items" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      itemCount: rows.length,
      mode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[VISION PARSE] Error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function compressImage(data: Buffer, ext: string): Promise<Buffer> {
  const tmpDir = path.join(process.cwd(), ".tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  const inputPath = path.join(tmpDir, `input-${Date.now()}.${ext}`);
  const outputPath = path.join(tmpDir, `compressed-${Date.now()}.jpg`);

  await fs.writeFile(inputPath, data);

  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [
      path.join(process.cwd(), "scripts/compress-image.py"),
      inputPath,
      outputPath,
      String(MAX_WIDTH),
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on("close", (code) => {
      fs.unlink(inputPath).catch(() => {});
      fs.unlink(outputPath).catch(() => {});

      if (code !== 0) {
        reject(new Error(`Compression failed: ${stderr}`));
        return;
      }
      resolve(Buffer.from(require("fs").readFileSync(outputPath as string)));
    });
    proc.on("error", reject);
  });
}
