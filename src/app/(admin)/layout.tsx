import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { AuthProvider } from "@/portals/admin/features/auth/hooks/use-auth";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
});

export const metadata: Metadata = {
  // Any route that exports its own `metadata.title` (the five (admin) pages,
  // via their server-component page.tsx wrappers) gets it interpolated into
  // "<title> · Lucena City Admin Portal"; a route with no title of its own
  // (login, forbidden, not-found, etc.) falls back to `default`, which is
  // the exact string this field used to hold — behavior-preserving for every
  // page that hasn't opted in yet.
  title: {
    template: "%s · Lucena City Admin Portal",
    default: "Lucena City Admin Portal",
  },
  description: "Admin portal for Lucena City service requests",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.className} ${instrumentSans.variable} bg-gray-50 text-gray-900 antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
