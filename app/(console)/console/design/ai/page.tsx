import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/org";
import { getDesignData } from "@/lib/org";
import { AiPanel } from "./ai-panel";
export const dynamic = "force-dynamic";

export default async function ConsoleDesignAiPage({
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
      <h1 className="font-display text-2xl font-bold mb-2 text-[var(--ink)]">
        AI
      </h1>
      <p className="text-sm text-[var(--ink-soft)] mb-6">
        Generate AI images and configure the AI chatbot for your restaurant site.
      </p>
      <AiPanel key={orgId}
        orgId={orgId}
        initialSettings={data.settings}
        orgName={data.orgName}
      />
    </div>
  );
}