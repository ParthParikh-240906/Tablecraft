import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/org";

export default async function CartSuccessPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  if (!orgSlug || !/^[a-z0-9-]{1,80}$/i.test(orgSlug)) {
    notFound();
  }
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    notFound();
  }
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <p className="text-4xl mb-4">✓</p>
      <h1 className="text-2xl font-bold mb-2">Payment received</h1>
      <p className="text-sm opacity-70 mb-6">
        Thanks! {org.name} is preparing your order. Show this screen if asked.
      </p>
      <Link href={`/${org.slug}/menu`} className="text-sm font-medium underline">
        Back to menu
      </Link>
    </div>
  );
}
