// src/app/(admin)/admin/(shell)/dashboard/page.tsx
//
// Thin server-component wrapper: this file's only job is to own the
// server-only `metadata` export (per-route <title>), which cannot live in a
// "use client" file. All actual page content/behavior lives in the
// dashboard feature's dashboard-page.tsx (see that file's header for why it
// exists as a sibling rather than being merged back in here).
import type { Metadata } from "next";
import { DashboardPage } from "@/portals/admin/features/dashboard/components/dashboard-page";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function Page() {
  return <DashboardPage />;
}
