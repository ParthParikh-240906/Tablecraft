import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    return {
      title: "Restaurant Not Found",
    };
  }

  return {
    title: org.name,
    description: org.tagline || `Welcome to ${org.name} - Browse our menu, book a table, and order ahead.`,
  };
}

export default async function OrgLandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  const mainColor = org.theme_color ?? "#141414";
  const textColor = org.theme_text_color ?? "#f5f5f4";
  const highlightColor = org.theme_secondary_color ?? "#f97316";

  return (
    <div className="min-h-screen" style={{ backgroundColor: mainColor, color: textColor }}>
      {/* Fixed background with parallax effect */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: org.background_image_url
            ? `url(${org.background_image_url})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        {/* Overlay for readability */}
        <div className="absolute inset-0" style={{ backgroundColor: `${mainColor}80` }} />
      </div>

      {/* Hero Section */}
      <section className="py-20 px-4 text-center relative">
        <div className="max-w-3xl mx-auto">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo_url}
              alt={`${org.name} logo`}
              className="h-20 w-20 rounded-full object-cover mx-auto mb-6 shadow-lg"
            />
          ) : (
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-lg"
              style={{ backgroundColor: highlightColor, color: mainColor }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Welcome to {org.name}
          </h1>
          {org.tagline && (
            <p className="text-xl mb-2 italic" style={{ color: `${textColor}cc` }}>
              {org.tagline}
            </p>
          )}
          <p className="text-lg mb-8" style={{ color: `${textColor}99` }}>
            Browse our menu, book a table, and order ahead — all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`/${org.slug}/menu`}
              className="px-6 py-3 rounded-full font-medium shadow-md hover:shadow-lg transition-shadow"
              style={{ backgroundColor: highlightColor, color: mainColor }}
            >
              View Menu
            </Link>
            <Link
              href={`/${org.slug}/reserve`}
              className="px-6 py-3 rounded-full border-2 font-medium backdrop-blur-sm hover:bg-white/10 transition-colors"
              style={{ borderColor: highlightColor, color: highlightColor }}
            >
              Book a Table
            </Link>
          </div>
        </div>
      </section>

      {/* About Section - Only shows if about_text exists */}
      {org.about_text && (
        <section className="py-16 px-4 backdrop-blur-sm" style={{ backgroundColor: `${mainColor}dd` }}>
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Text content */}
              <div>
                <h2 className="text-3xl font-bold mb-6">About Us</h2>
                <p className="leading-relaxed whitespace-pre-line" style={{ color: `${textColor}cc` }}>
                  {org.about_text}
                </p>
              </div>

              {/* Restaurant image - Only shows if restaurant_image_url exists */}
              {org.restaurant_image_url && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={org.restaurant_image_url}
                    alt={`${org.name} restaurant`}
                    className="rounded-2xl shadow-2xl w-full h-80 object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Location & Contact Section */}
      <section className="py-16 px-4 backdrop-blur-sm" style={{ backgroundColor: `${mainColor}ee` }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">
            Location & Contact
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Branches */}
            {org.branches && org.branches.length > 0 && (
              <div className="rounded-xl p-6 shadow-md border-2" style={{ 
                backgroundColor: `${mainColor}ff`,
                borderColor: `${highlightColor}44`
              }}>
                <h3 className="font-semibold text-lg mb-4">Locations</h3>
                <ul className="space-y-2">
                  {org.branches.map((branch: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-1" style={{ color: highlightColor }}>•</span>
                      <span>{branch}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact Info */}
            {(org.contact_phone || org.contact_email || org.contact_address) && (
              <div className="rounded-xl p-6 shadow-md border-2" style={{ 
                backgroundColor: `${mainColor}ff`,
                borderColor: `${highlightColor}44`
              }}>
                <h3 className="font-semibold text-lg mb-4">Contact Us</h3>
                <div className="space-y-3">
                  {org.contact_phone && (
                    <div className="flex items-start gap-3">
                      <span className="font-medium min-w-20">Phone:</span>
                      <a 
                        href={`tel:${org.contact_phone}`}
                        className="hover:underline"
                      >
                        {org.contact_phone}
                      </a>
                    </div>
                  )}
                  {org.contact_email && (
                    <div className="flex items-start gap-3">
                      <span className="font-medium min-w-20">Email:</span>
                      <a 
                        href={`mailto:${org.contact_email}`}
                        className="hover:underline"
                      >
                        {org.contact_email}
                      </a>
                    </div>
                  )}
                  {org.contact_address && (
                    <div className="flex items-start gap-3">
                      <span className="font-medium min-w-20">Address:</span>
                      <span>{org.contact_address}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fallback if no location/contact data */}
          {(!org.branches || org.branches.length === 0) && 
           !org.contact_phone && !org.contact_email && !org.contact_address && (
            <div className="text-center py-8" style={{ color: `${textColor}66` }}>
              <p>Location and contact information coming soon.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
