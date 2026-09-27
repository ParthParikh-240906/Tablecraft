"use client";

export function ConsoleSidebarOverlay() {
  return (
    <div
      id="console-sidebar-overlay"
      className="hidden fixed inset-0 bg-black/50 z-40 lg:hidden"
      onClick={() => {
        const sidebar = document.getElementById("console-sidebar");
        const overlay = document.getElementById("console-sidebar-overlay");
        sidebar?.classList.add("hidden");
        sidebar?.classList.remove("fixed", "inset-0", "z-50", "lg:block");
        overlay?.classList.add("hidden");
      }}
    />
  );
}
