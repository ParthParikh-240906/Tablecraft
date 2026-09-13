import { createClient } from "@/lib/supabase/server";
import { getDesignData } from "@/lib/org";
import { BookATablePanel } from "./book-a-table-panel";

export default async function ConsoleDesignBookATablePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from("staff_users")
    .select("org_id")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();

  if (!staff?.org_id) return null;

  const data = await getDesignData(staff.org_id);
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold mb-2 text-[var(--ink)]">
        Book a Table Page
      </h1>
      <p className="text-sm text-[var(--ink-soft)] mb-6">
        Style the public booking page — headings, labels, and the submit button.
      </p>
      <BookATablePanel
        orgId={staff.org_id}
        orgName={data.orgName}
        initialSettings={data.settings}
      />
    </div>
  );
}