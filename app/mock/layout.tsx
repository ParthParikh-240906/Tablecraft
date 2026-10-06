import type { Metadata } from "next";

// Internal preview route — hidden from search and review indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
