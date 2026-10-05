import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireStaffForOrgId } from "@/lib/api-auth";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const { org_id, name } = (body ?? {}) as { org_id?: unknown; name?: unknown };
    if (typeof org_id !== "string" || !org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }
    const auth = await requireStaffForOrgId(org_id);
    if ("response" in auth) return auth.response;

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return NextResponse.json({ error: "Name must be 2–100 characters" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("organizations")
      .update({ name: trimmed })
      .eq("id", org_id);

    if (error) {
      console.error("update name:", error);
      return NextResponse.json({ error: "Could not save name. Please try again." }, { status: 500 });
    }

    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("design/name POST unhandled:", err);
    return NextResponse.json({ error: "Could not save name. Please try again." }, { status: 500 });
  }
}
