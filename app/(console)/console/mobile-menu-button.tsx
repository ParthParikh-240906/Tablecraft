"use client";

export function MobileMenuButton() {
  return (
    <button
      type="button"
      className="lg:hidden p-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
      aria-label="Toggle menu"
      onClick={() => {
        const sidebar = document.getElementById("console-sidebar");
        const overlay = document.getElementById("console-sidebar-overlay");
        sidebar?.classList.toggle("hidden");
        sidebar?.classList.toggle("fixed");
        sidebar?.classList.toggle("inset-0");
        sidebar?.classList.toggle("z-50");
        overlay?.classList.toggle("hidden");
      }}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
