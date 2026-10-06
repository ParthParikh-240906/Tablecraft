import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://tablecraft-beige.vercel.app",
  ),
  title: {
    default: "Tablecraft — Restaurant Management Platform",
    template: "%s | Tablecraft",
  },
  description:
    "AI-powered website builder and operator console for restaurants and cafes. Manage your website, tables, bookings, and orders all in one place.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.svg",
  },
  manifest: "/manifest.webmanifest",
  themeColor: "#0a0a0a",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Tablecraft",
    images: [{ url: "/og-cover.svg", width: 1200, height: 630, alt: "Tablecraft" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-cover.svg"],
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-[var(--ink)]">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
