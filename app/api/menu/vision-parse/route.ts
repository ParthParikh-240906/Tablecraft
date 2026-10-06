import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffForOrgId } from "@/lib/api-auth";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

const COMPRESSION_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 1920;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 500;
const MAX_NAME_LEN = 200;
const MAX_DESC_LEN = 500;
const MAX_CATEGORY_LEN = 100;

/**
 * POST /api/menu/vision-parse
 * Upload a menu image → Gemini vision extracts items → save to DB.
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
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

    if (mode !== "append" && mode !== "replace") {
      return NextResponse.json(
        { error: "mode must be 'append' or 'replace'" },
        { status: 400 }
      );
    }

    // Validate image type
    const ext = (file.name ?? "").toLowerCase().split(".").pop();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
      return NextResponse.json(
        { error: "Only image files are supported (JPG, PNG, WebP)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const fileSize = bytes.byteLength;
    if (fileSize === 0 || fileSize > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
    }

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
    const apiKey = process.env.AGNES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AGNES_API_KEY not configured" },
        { status: 500 }
      );
    }

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

    const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "agnes-2.5-flash",
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
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[VISION PARSE] API error:", response.status, errText.slice(0, 500));
      return NextResponse.json(
        { error: "Could not parse the menu image. Please try again." },
        { status: 502 }
      );
    }

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("[VISION PARSE] Response is not JSON:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "Could not parse the menu image. Please try again." },
        { status: 502 }
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Could not parse the menu image. Please try again." },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let parsed: { items: Array<{ name: string; description?: string; price: number; category?: string }> };
    try {
      // Strip markdown code blocks if present
      const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0];
      parsed = JSON.parse(jsonMatch ?? content);
    } catch (e) {
      console.error("[VISION PARSE] JSON parse failed:", e);
      return NextResponse.json(
        { error: "Could not parse the menu image. Please try again." },
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
      (item) => item.price != null && typeof item.price === "number" && Number.isFinite(item.price) && typeof item.name === "string" && item.name.trim()
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "No valid menu items found in the image" },
        { status: 400 }
      );
    }
    if (validItems.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Too many menu items in the image" }, { status: 400 });
    }

    // Insert into DB
    const supabase = createAdminClient();
    if (mode === "replace") {
      const { error: deleteError } = await supabase.from("menu_items").delete().eq("org_id", orgId);
      if (deleteError) {
        console.error("[VISION PARSE] Delete error:", deleteError);
        return NextResponse.json(
          { error: "Could not save menu items. Please try again." },
          { status: 500 }
        );
      }
    }

    // Calculate category_sort_order based on first appearance of each category
    const categoryOrder: Record<string, number> = {};
    let catIdx = 0;
    for (const item of validItems) {
      const cat = item.category || "Other";
      if (!(cat in categoryOrder)) {
        categoryOrder[cat] = catIdx++;
      }
    }

    const rows = validItems.slice(0, MAX_ITEMS).map((item, index) => ({
      org_id: orgId,
      name: String(item.name).slice(0, MAX_NAME_LEN),
      description: typeof item.description === "string" ? item.description.slice(0, MAX_DESC_LEN) : null,
      price: Number(item.price),
      category: typeof item.category === "string" ? item.category.slice(0, MAX_CATEGORY_LEN) : null,
      available: true,
      sort_order: index + 1,
      category_sort_order: categoryOrder[item.category || "Other"] ?? 0,
    }));

    const { error: insertError } = await supabase
      .from("menu_items")
      .insert(rows);

    if (insertError) {
      console.error("[VISION PARSE] Insert error:", insertError);
      return NextResponse.json(
        { error: "Could not save menu items. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      itemCount: rows.length,
      mode,
    });
  } catch {
    console.error("[VISION PARSE] unhandled error");
    return NextResponse.json(
      { error: "Could not parse the menu image. Please try again." },
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
