import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPresetColors, DEFAULT_PRESET, isValidPreset, type ThemePresetKey } from "@/lib/theme";

/**
 * POST /api/signup
 * Creates a new restaurant organization + owner staff account in one go.
 *
 * Flow:
 *   1. Validate inputs (org name, slug, owner email, password)
 *   2. Create the Supabase Auth user (admin API, email confirmed)
 *   3. Upload logo/background images if provided
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
  const presetKey = formData.get('preset') as string;
  
  // Optional fields
  const branchesStr = formData.get('branches') as string;
  const contactPhone = formData.get('contactPhone') as string;
  const contactEmail = formData.get('contactEmail') as string;
  const contactAddress = formData.get('contactAddress') as string;
  const aboutText = formData.get('aboutText') as string;
  const logoFile = formData.get('logoFile') as File;
  const backgroundFile = formData.get('backgroundFile') as File;
  const restaurantImageFile = formData.get('restaurantImageFile') as File;

  console.log("[SIGNUP] Incoming request:", { orgName, slug, email, hasTagline: !!tagline, presetKey, hasLogo: !!logoFile, hasBackground: !!backgroundFile, hasRestaurantImage: !!restaurantImageFile });

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

  // --- Theme preset (required; use default if invalid) ---
  const validPresetKey = (presetKey && isValidPreset(presetKey)) ? presetKey as ThemePresetKey : DEFAULT_PRESET;
  const presetColors = getPresetColors(validPresetKey);
  
  console.log("[SIGNUP] Using preset:", validPresetKey, presetColors);

  // --- File uploads (if provided) ---
  let logoUrl: string | null = null;
  let backgroundUrl: string | null = null;
  let restaurantImageUrl: string | null = null;

  if (logoFile || backgroundFile || restaurantImageFile) {
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

      // Upload background
      if (backgroundFile) {
        const fileExt = backgroundFile.name.split('.').pop();
        const fileName = `background-${Date.now()}.${fileExt}`;
        const filePath = `${slug}/${fileName}`;
        
        const { data: bgData, error: bgError } = await admin.storage
          .from('org-backgrounds')
          .upload(filePath, backgroundFile);
          
        if (bgError) {
          console.error("[SIGNUP] Background upload failed:", bgError);
        } else {
          const { data: { publicUrl } } = admin.storage
            .from('org-backgrounds')
            .getPublicUrl(filePath);
          backgroundUrl = publicUrl;
          console.log("[SIGNUP] Background uploaded:", backgroundUrl);
        }
      }

      // Upload restaurant image
      if (restaurantImageFile) {
        const fileExt = restaurantImageFile.name.split('.').pop();
        const fileName = `restaurant-${Date.now()}.${fileExt}`;
        const filePath = `${slug}/${fileName}`;
        
        const { data: restaurantImageData, error: restaurantImageError } = await admin.storage
          .from('org-restaurant-images')
          .upload(filePath, restaurantImageFile);
          
        if (restaurantImageError) {
          console.error("[SIGNUP] Restaurant image upload failed:", restaurantImageError);
        } else {
          const { data: { publicUrl } } = admin.storage
            .from('org-restaurant-images')
            .getPublicUrl(filePath);
          restaurantImageUrl = publicUrl;
          console.log("[SIGNUP] Restaurant image uploaded:", restaurantImageUrl);
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
    theme_color: presetColors.main,
    theme_text_color: presetColors.text,
    theme_secondary_color: presetColors.highlight,
    tagline: tagline && tagline.trim().length > 0 ? tagline.trim() : null,
  };

  // Add optional fields if provided
  if (branches && branches.length > 0) orgData.branches = branches;
  if (contactPhone) orgData.contact_phone = contactPhone;
  if (contactEmail) orgData.contact_email = contactEmail;
  if (contactAddress) orgData.contact_address = contactAddress;
  if (aboutText) orgData.about_text = aboutText;
  if (logoUrl) orgData.logo_url = logoUrl;
  if (backgroundUrl) orgData.background_image_url = backgroundUrl;
  if (restaurantImageUrl) orgData.restaurant_image_url = restaurantImageUrl;

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