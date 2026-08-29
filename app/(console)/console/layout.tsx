import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Console layout: resolves the logged-in staff member's organization.
 * Auth gating itself happens in middleware.ts; this adds the staff check —
 * a valid auth user who is NOT in staff_users gets no console access.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/console/login");
  }

  // Look up the staff row for this auth user to resolve their org.
  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id, role, email, organizations(name, slug, theme_color)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff) {
    return (
      <div className="surface-dark min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl mb-2">Not a staff member</h1>
          <p className="text-sm text-[var(--ink-faint)]">
            This account ({user.email}) isn't linked to a restaurant
            staff role. Ask the restaurant owner to add you.
          </p>
        </div>
      </div>
    );
  }

  const org = Array.isArray(staff.organizations)
    ? staff.organizations[0]
    : staff.organizations;

  return (
    <div className="surface-dark min-h-screen">
      <header className="border-b border-[var(--rule)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="label-caps text-[color:var(--accent)]">
              Operator Console
            </p>
            <p className="font-display text-lg">{org?.name ?? "Unknown org"}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <nav className="flex items-center gap-3">
              <Link href="/console/tables" className="hover:underline">
                Tables
              </Link>
              <Link href="/console/bookings" className="hover:underline">
                Bookings
              </Link>
              <Link href="/console/menu" className="hover:underline">
                Menu
              </Link>
              <span className="text-[var(--rule)]">|</span>
              {org?.slug && (
                <Link href={`/${org.slug}`} className="hover:underline">
                  View my restaurant
                </Link>
              )}
              <Link href="/" className="hover:underline">
                Back to Tablecraft
              </Link>
            </nav>
            <span className="text-[var(--ink-faint)]">{staff.email}</span>
            <span className="px-2 py-0.5 rounded-sm border border-[var(--rule)] text-xs font-medium">
              {staff.role}
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}