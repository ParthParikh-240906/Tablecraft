"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LogoutButtonProps {
  isDemo?: boolean;
  orgId?: string;
}

export function LogoutButton({ isDemo, orgId }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    // If in demo mode, restore snapshot before signing out
    if (isDemo && orgId) {
      try {
        await fetch("/api/demo/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId }),
        });
      } catch {
        // ignore restore errors
      }
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/console/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-xs text-[var(--ink-faint)] hover:text-red-400 font-medium transition-colors cursor-pointer"
    >
      Sign out
    </button>
  );
}