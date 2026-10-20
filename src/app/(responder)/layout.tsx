import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/portals/responder/components/layout/service-worker";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LucenaPortal Responder",
  description: "LGU Responder Portal — Lucena City Service Management System",
  manifest: "/responder/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Responder",
    statusBarStyle: "default",
  },
  icons: { apple: "/Lucena_City_Seal.png" },
};

export const viewport: Viewport = {
  themeColor: "#003DA5",
  width: "device-width",
  initialScale: 1,
  // Not locking zoom: field use on a phone, and disabling it fails WCAG 1.4.4.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-lucena-backdrop text-gray-900 antialiased">
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
