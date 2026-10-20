// src/app/(admin)/admin/(shell)/convention-center/page.tsx
//
// Thin server-component wrapper: this file's only job is to own the
// server-only `metadata` export (per-route <title>), which cannot live in a
// "use client" file. All actual page content/behavior lives in the
// booking feature's convention-center-page.tsx (see that file's header for
// why it exists as a sibling rather than being merged back in here).
import type { Metadata } from "next";
import { ConventionCenterPage } from "@/portals/admin/features/booking/components/convention-center-page";

export const metadata: Metadata = {
  title: "Convention Center",
};

export default function Page() {
  return <ConventionCenterPage />;
}
