import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tablecraft — Restaurant Management Platform",
    template: "%s | Tablecraft",
  },
  description:
    "AI-powered website builder and operator console for restaurants and cafes. Manage your website, tables, bookings, and orders all in one place.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Tablecraft",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className="h-full antialiased"
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#060504" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-[var(--ink)]">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
