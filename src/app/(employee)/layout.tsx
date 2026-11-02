import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// The one City employee sign-in (ADR 0009). Kept out of search results with
// noindex rather than a robots.txt Disallow, which would advertise the path.
export const metadata: Metadata = {
  title: "City employee sign-in · Lucena City",
  description: "Sign-in for Lucena City employees.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
