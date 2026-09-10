import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getThemeColors } from "@/lib/theme";
import bcrypt from "bcryptjs";

/**
 * POST /api/signup
 * Creates a new restaurant organization + owner staff account in one go.
 *
 * Two modes:
 *   A) Authenticated (OAuth user): session user's auth_user_id used directly,
 *      email locked to session email. Optional consolePassword stored independently.
 *   B) Unauthenticated: creates a new Supabase Auth user (email + password),
 *      same as the original flow. Optional consolePassword.
 *
 * Flow:
 *   1. Validate inputs
 *   2. Check session or create auth user
 *   3. Upload logo if provided
 *   4. Create the organization row with optional fields
 *   5. Create the staff_users owner row linked to the auth user
 *   6. Optionally hash + store consolePassword in staff_users
 */
export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const orgName = formData.get('orgName') as string;
  const slug = formData.get('slug') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const tagline = formData.get('tagline') as string;
  const consolePassword = formData.get('consolePassword') as string | null;

  // Optional fields
  const branchesStr = formData.get('branches') as string;
  const contactPhone = formData.get('contactPhone') as string;
  const contactEmail = formData.get('contactEmail') as string;
  const contactAddress = formData.get('contactAddress') as string;
  const aboutText = formData.get('aboutText') as string;
  const logoFile = formData.get('logoFile') as File;
  const restaurantImageFiles = formData.getAll('restaurantImageFiles') as File[];

  console.log("[SIGNUP] Incoming request:", { orgName, slug, email, hasTagline: !!tagline, hasLogo: !!logoFile, hasRestaurantImages: restaurantImageFiles.length > 0 });

  // --- Validate inputs ---
  if (!orgName || typeof orgName !== "string" || orgName.trim().length < 2) {
    return NextResponse.json({ error: "orgName must be at least 2 characters" }, { status: 400 });
  }
  if (!slug || typeof slug !== "string" || !/^[a-z0-9-]{2,40}$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be 2-40 chars: lowercase letters, numbers, hyphens" },
      { status: 400 },
    );
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!aboutText || typeof aboutText !== "string" || aboutText.trim().length < 10) {
    return NextResponse.json({ error: "Please provide a short description of your restaurant" }, { status: 400 });
  }

  const admin = createAdminClient();

  // --- Check slug is not taken ---
  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingOrg) {
    return NextResponse.json({ error: "That URL slug is already taken" }, { status: 409 });
  }

  // --- Determine auth user: session-based (OAuth) or create new (email+password) ---
  let authUserId: string;
  let isSessionUser = false;

  // Try to read the session cookie
  const serverClient = await createClient();
  const { data: { user: sessionUser } } = await serverClient.auth.getUser();

  if (sessionUser && sessionUser.email?.toLowerCase() === email.trim().toLowerCase()) {
    // Authenticated user — use their auth_user_id directly
    authUserId = sessionUser.id;
    isSessionUser = true;
    console.log("[SIGNUP] Authenticated session user:", sessionUser.email);
  } else {
    // Not authenticated (or email mismatch) — create a new auth user
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
    }

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
      }
      console.error("signup: auth user creation failed", authError);
      return NextResponse.json({ error: "Could not create account" }, { status: 500 });
    }

    authUserId = authUser.user.id;
    console.log("[SIGNUP] Created new auth user:", authUser.user.email);
  }

  // --- Restaurant limit check (3 for free accounts, 20 for pro/max) ---
  {
    const { data: existingStaff } = await admin
      .from("staff_users")
      .select("organizations(subscription_plan)")
      .eq("auth_user_id", authUserId);

    const orgCount = existingStaff?.length ?? 0;
    const hasPaid = existingStaff?.some((r: any) => {
      const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return org?.subscription_plan === "pro" || org?.subscription_plan === "max";
    });
    const limit = hasPaid ? 20 : 3;

    if (orgCount >= limit) {
      if (!isSessionUser) {
        await admin.auth.admin.deleteUser(authUserId);
      }
      return NextResponse.json(
        {
          error: hasPaid
            ? "You've reached the 20-restaurant limit for Pro/Max accounts."
            : `Free accounts can have up to ${limit} restaurants. Upgrade to Pro to unlock more.`,
        },
        { status: 409 },
      );
    }
  }

  // --- Parse optional fields ---
  let branches: string[] | null = null;
  if (branchesStr) {
    try {
      const parsed = JSON.parse(branchesStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        branches = parsed.filter(b => typeof b === 'string' && b.trim().length > 0);
      }
    } catch (e) {
      console.error("[SIGNUP] Failed to parse branches JSON:", e);
    }
  }

  // --- Theme (unified for all restaurants) ---
  const themeColors = getThemeColors();

  console.log("[SIGNUP] Using unified theme:", themeColors);

   // --- File uploads (if provided) ---
   let logoUrl: string | null = null;
   let restaurantImageUrls: string[] = [];

   if (logoFile || restaurantImageFiles.length > 0) {
     console.log("[SIGNUP] Processing file uploads...");
     const uploadAdmin = createAdminClient();

     try {
       // Upload logo
       if (logoFile) {
         const fileExt = logoFile.name.split('.').pop();
         const fileName = `logo-${Date.now()}.${fileExt}`;
         const filePath = `${slug}/${fileName}`;

         const { data: logoData, error: logoError } = await uploadAdmin.storage
           .from('org-logos')
           .upload(filePath, logoFile);

         if (logoError) {
           console.error("[SIGNUP] Logo upload failed:", logoError);
         } else {
           const { data: { publicUrl } } = uploadAdmin.storage
             .from('org-logos')
             .getPublicUrl(logoData.path);
           logoUrl = publicUrl;
           console.log("[SIGNUP] Logo uploaded:", logoUrl);
         }
       }

       // Upload restaurant images
       if (restaurantImageFiles.length > 0) {
         const imageUrls: string[] = [];
         for (const image of restaurantImageFiles) {
           if (!image || image.size === 0) continue;
           const fileExt = image.name.split('.').pop();
           const fileName = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
           const filePath = `${slug}/${fileName}`;

           const { data: imgData, error: imgError } = await uploadAdmin.storage
             .from('org-logos')
             .upload(filePath, image);

           if (!imgError && imgData) {
             const { data: { publicUrl } } = uploadAdmin.storage
               .from('org-logos')
               .getPublicUrl(imgData.path);
             imageUrls.push(publicUrl);
           }
         }
         restaurantImageUrls = imageUrls;
         console.log("[SIGNUP] Restaurant images uploaded:", restaurantImageUrls.length);
       }
     } catch (uploadErr) {
       console.error("[SIGNUP] Upload error:", uploadErr);
       // Continue — uploads are non-fatal
     }
   }

  // --- Create the organization row ---
  const orgData: Record<string, any> = {
    name: orgName.trim(),
    slug,
    theme_color: themeColors.main,
    theme_text_color: themeColors.text,
    theme_secondary_color: themeColors.highlight,
    tagline: tagline && tagline.trim().length > 0 ? tagline.trim() : null,
  };
  if (branches && branches.length > 0) orgData.branches = branches;
  if (contactPhone) orgData.contact_phone = contactPhone;
  if (contactEmail) orgData.contact_email = contactEmail;
  if (contactAddress) orgData.contact_address = contactAddress;
  if (aboutText) orgData.about_text = aboutText;
  if (logoUrl) orgData.logo_url = logoUrl;
  if (restaurantImageUrls.length > 0) orgData.restaurant_photos = restaurantImageUrls;

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert(orgData)
    .select()
    .single();

  if (orgError) {
    console.error("signup: org creation failed", orgError);
    // Roll back the auth user only if we just created it (not a session user)
    if (!isSessionUser) {
      await admin.auth.admin.deleteUser(authUserId);
    }
    return NextResponse.json({ error: "Could not create organization" }, { status: 500 });
  }

  // --- Hash optional console password ---
  let consolePasswordHash: string | null = null;
  if (consolePassword && consolePassword.length >= 8) {
    consolePasswordHash = await bcrypt.hash(consolePassword, 10);
  }

  // --- Create the owner staff row ---
  const staffRow: Record<string, any> = {
    org_id: org.id,
    email: email.trim().toLowerCase(),
    role: "owner",
    auth_user_id: authUserId,
  };

  // Insert with console_password_hash; if the column isn't migrated yet,
  // retry without it so restaurant creation still works.
  const { error: staffError } = await (async () => {
    if (consolePasswordHash) {
      const withHash = await admin.from("staff_users").insert({ ...staffRow, console_password_hash: consolePasswordHash });
      if (withHash.error?.code === "PGRST204" || withHash.error?.message?.includes("console_password_hash")) {
        console.warn("signup: console_password_hash column missing — storing without it");
      } else {
        return withHash;
      }
    }
    return admin.from("staff_users").insert(staffRow);
  })();

  if (staffError) {
    console.error("signup: staff creation failed", staffError);
    // Roll back the org
    await admin.from("organizations").delete().eq("id", org.id);
    if (!isSessionUser) {
      await admin.auth.admin.deleteUser(authUserId);
    }

    if (staffError.code === "23505" && staffError.message?.includes("staff_users_auth_user_id_key")) {
      return NextResponse.json(
        {
          error:
            "Could not link staff account — this account may already own a restaurant. " +
            "If this persists, run the SQL migration:\n" +
            "ALTER TABLE public.staff_users DROP CONSTRAINT staff_users_auth_user_id_key;",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Could not create staff account" }, { status: 500 });
  }

  return NextResponse.json(
    { org: { id: org.id, name: org.name, slug: org.slug } },
    { status: 201 },
  );
}
