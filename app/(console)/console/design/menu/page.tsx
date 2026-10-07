import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { getDesignData } from "@/lib/org";
import { MenuPagePanel } from "./menu-page-panel";
import { DesignDeviceProvider } from "../design-device";
export const dynamic = "force-dynamic";

export default async function ConsoleDesignMenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/console/login");
  const orgId = await getActiveOrgId(user.id, params.org) ?? "";
  if (!orgId) return null;

  const data = await getDesignData(orgId);
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold mb-2 text-[var(--ink)]">
            Menu Page
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Style the public menu page — headings, categories, and items.
          </p>
        </div>
        {data.org.slug && (
          <a
            href={`/${data.org.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline text-xs px-3 py-1.5"
          >
            Preview Site →
          </a>
        )}
      </div>
      <DesignDeviceProvider>
        <MenuPagePanel key={orgId}
          orgId={orgId}
          orgName={data.orgName}
          initialSettings={data.settings}
        />
      </DesignDeviceProvider>
    </div>
  );
}