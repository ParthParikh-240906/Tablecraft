import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

export default async function ConsoleDesignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const org = params.org ? `?org=${encodeURIComponent(params.org)}` : "";
  redirect(`/console/design/website${org}`);
}
