import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

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
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--paper)] text-[var(--ink)]">
        <div className="max-w-md text-center ticket p-8">
          <h1 className="font-display text-xl mb-2">Not a staff member</h1>
          <p className="text-sm text-[var(--ink-soft)] mb-6">
            This account ({user.email}) isn't linked to a restaurant
            staff role. Ask the restaurant owner to add you.
          </p>
          <Link href="/" className="btn btn-outline text-xs">
            ← Back to Tablecraft
          </Link>
        </div>
      </div>
    );
  }

  const org = Array.isArray(staff.organizations)
    ? staff.organizations[0]
    : staff.organizations;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-caps text-[color:var(--accent)]">
              Operator Console
            </p>
            <p className="font-display text-lg text-[var(--ink)]">{org?.name ?? "Restaurant"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <nav className="flex items-center gap-3">
              <Link href="/console" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Dashboard
              </Link>
              <Link href="/console/tables" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Tables
              </Link>
              <Link href="/console/bookings" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Bookings
              </Link>
              <Link href="/console/orders" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Orders
              </Link>
              <Link href="/console/kitchen" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Kitchen
              </Link>
              <Link href="/console/menu" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Menu
              </Link>
              <Link href="/console/design" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Design
              </Link>
              <span className="text-[var(--rule)]">|</span>
              {org?.slug && (
                <Link href={`/${org.slug}`} className="text-[var(--accent)] hover:underline font-medium">
                  Public Storefront →
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-3 border-l border-[var(--rule)] pl-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--ink-faint)] hidden sm:inline">{staff.email}</span>
                <span className="px-2 py-0.5 rounded-sm border border-[var(--rule)] text-[10px] font-medium uppercase tracking-wider text-[var(--ink-soft)]">
                  {staff.role}
                </span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}