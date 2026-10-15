"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Delete button for one restaurant row.
 * Asks for confirmation, calls the delete API, then refreshes the
 * server-rendered dashboard so the list auto-updates.
 */
export function DeleteRestaurantButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${orgName}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/restaurants/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) {
        router.refresh(); // re-fetch server component -> row disappears
      } else {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Could not delete restaurant");
        setDeleting(false);
      }
    } catch {
      window.alert("Could not delete restaurant");
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {deleting ? "..." : "Delete"}
    </button>
  );
}