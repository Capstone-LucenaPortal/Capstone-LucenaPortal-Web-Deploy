import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LucenaPortal Super Staff",
  description:
    "Platform administration for the Lucena City Strategic Service Management System.",
  // Staff-side pages stay out of search results (ADR 0009). Not a robots.txt
  // Disallow, which would advertise the path.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
