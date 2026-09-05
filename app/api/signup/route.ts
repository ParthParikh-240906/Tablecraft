import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getThemeColors } from "@/lib/theme";

/**
 * POST /api/signup
 * Creates a new restaurant organization + owner staff account in one go.
 *
 * Flow:
 *   1. Validate inputs (org name, slug, owner email, password)
 *   2. Create the Supabase Auth user (admin API, email confirmed)
 *   3. Upload logo if provided
 *   4. Create the organization row with optional fields
 *   5. Create the staff_users owner row linked to the auth user
 *
 * Uses the service-role client (bypasses RLS) — this is the sanctioned
 * public signup path. All inputs validated server-side.
 * 
 * Precedence rule: Manual user inputs override AI-generated theme values.
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
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
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

  // --- Create the auth user ---
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });

  if (authError) {
    // Common: email already registered
    if (authError.message?.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    }
    console.error("signup: auth user creation failed", authError);
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
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
     const admin = createAdminClient();
     
     try {
       // Upload logo
       if (logoFile) {
         const fileExt = logoFile.name.split('.').pop();
         const fileName = `logo-${Date.now()}.${fileExt}`;
         const filePath = `${slug}/${fileName}`;
         
         const { data: logoData, error: logoError } = await admin.storage
           .from('org-logos')
           .upload(filePath, logoFile);
           
         if (logoError) {
           console.error("[SIGNUP] Logo upload failed:", logoError);
         } else {
           const { data: { publicUrl } } = admin.storage
             .from('org-logos')
             .getPublicUrl(filePath);
           logoUrl = publicUrl;
           console.log("[SIGNUP] Logo uploaded:", logoUrl);
         }
       }

       // Upload restaurant images
       for (const file of restaurantImageFiles) {
         const fileExt = file.name.split('.').pop();
         const fileName = `restaurant-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
         const filePath = `${slug}/${fileName}`;

         const { data: restaurantImageData, error: restaurantImageError } = await admin.storage
           .from('org-restaurant-images')
           .upload(filePath, file);

         if (restaurantImageError) {
           console.error("[SIGNUP] Restaurant image upload failed:", restaurantImageError);
         } else {
           const { data: { publicUrl } } = admin.storage
             .from('org-restaurant-images')
             .getPublicUrl(filePath);
           restaurantImageUrls.push(publicUrl);
           console.log("[SIGNUP] Restaurant image uploaded:", publicUrl);
         }
       }
     } catch (e) {
       console.error("[SIGNUP] File upload error:", e);
       // Continue without uploads - non-blocking
     }
   }

  // --- Create the organization with optional fields ---
  const orgData: any = {
    name: orgName.trim(),
    slug,
    theme_color: themeColors.main,
    theme_text_color: themeColors.text,
    theme_secondary_color: themeColors.highlight,
    tagline: tagline && tagline.trim().length > 0 ? tagline.trim() : null,
  };

  // Add optional fields if provided
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
    // Roll back the auth user so we don't leave an orphan account
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: "Could not create organization" }, { status: 500 });
  }

  // --- Create the owner staff row ---
  const { error: staffError } = await admin.from("staff_users").insert({
    org_id: org.id,
    email: email.trim().toLowerCase(),
    role: "owner",
    auth_user_id: authUser.user.id,
  });

  if (staffError) {
    console.error("signup: staff creation failed", staffError);
    // Roll back both the org and the auth user
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: "Could not create staff account" }, { status: 500 });
  }

  return NextResponse.json(
    { org: { id: org.id, name: org.name, slug: org.slug } },
    { status: 201 },
  );
}