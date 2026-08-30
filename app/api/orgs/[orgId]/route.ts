import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * DELETE /api/orgs/[orgId]
 * Deletes an organization and all its related data via cascade.
 * This is a destructive operation that cannot be undone.
 * 
 * Order: Org first (safer failure mode), then auth cleanup.
 * 
 * Cascade deletes (from schema):
 * - staff_users (via org_id FK with ON DELETE CASCADE)
 * - menu_items (via org_id FK with ON DELETE CASCADE)
 * - tables (via org_id FK with ON DELETE CASCADE)
 * - bookings (via org_id FK with ON DELETE CASCADE)
 * - orders (via org_id FK with ON DELETE CASCADE)
 * 
 * Also cleans up:
 * - Auth users linked to the org
 * - Storage files (logos, backgrounds)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  console.log("[DELETE ORG API] Called with orgId:", orgId);

  if (!orgId || typeof orgId !== "string") {
    console.error("[DELETE ORG API] Invalid org ID");
    return NextResponse.json({ error: "Invalid org ID" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
    console.log("[DELETE ORG API] Admin client created successfully");
  } catch (error) {
    console.error("[DELETE ORG API] Failed to create admin client:", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    // First, get all staff users for this org for later auth cleanup
    console.log("[DELETE ORG API] Fetching staff users for org:", orgId);
    const { data: staffUsers, error: staffError } = await admin
      .from("staff_users")
      .select("auth_user_id")
      .eq("org_id", orgId);

    if (staffError) {
      console.error("[DELETE ORG API] Failed to fetch staff users:", staffError);
      return NextResponse.json({ error: "Failed to fetch staff users" }, { status: 500 });
    }
    
    console.log("[DELETE ORG API] Found staff users:", staffUsers?.length || 0);

    // Delete organization FIRST (safer failure mode - cascade handles staff_users)
    console.log("[DELETE ORG API] Deleting organization:", orgId);
    const { error: deleteError } = await admin
      .from("organizations")
      .delete()
      .eq("id", orgId);

    if (deleteError) {
      console.error("[DELETE ORG] Failed to delete organization:", deleteError);
      return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
    }

    console.log("[DELETE ORG API] Organization deleted successfully");

    // Then attempt auth cleanup (non-critical - org is already gone)
    let authCleanupFailed = false;
    if (staffUsers && staffUsers.length > 0) {
      for (const staff of staffUsers) {
        if (staff.auth_user_id) {
          const { error: deleteAuthError } = await admin.auth.admin.deleteUser(
            staff.auth_user_id
          );
          if (deleteAuthError) {
            console.error("[DELETE ORG] Failed to delete auth user:", deleteAuthError);
            authCleanupFailed = true;
          }
        }
      }
    }

    // Clean up storage files if they exist (non-critical)
    try {
      // Delete logo files
      const { data: logoFiles } = await admin.storage
        .from("org-logos")
        .list(orgId, { limit: 100 });
      
      if (logoFiles && logoFiles.length > 0) {
        const filePaths = logoFiles.map(f => `${orgId}/${f.name}`);
        await admin.storage.from("org-logos").remove(filePaths);
      }

      // Delete background files
      const { data: bgFiles } = await admin.storage
        .from("org-backgrounds")
        .list(orgId, { limit: 100 });
      
      if (bgFiles && bgFiles.length > 0) {
        const filePaths = bgFiles.map(f => `${orgId}/${f.name}`);
        await admin.storage.from("org-backgrounds").remove(filePaths);
      }
    } catch (storageError) {
      console.error("[DELETE ORG] Storage cleanup error (non-blocking):", storageError);
      // Continue - org is already deleted from DB
    }

    // Revalidate the restaurants page
    revalidatePath("/restaurants");

    // Return success with warning if auth cleanup failed
    if (authCleanupFailed) {
      return NextResponse.json(
        { 
          success: true, 
          warning: "Organization deleted but some auth accounts may remain" 
        }, 
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE ORG] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}