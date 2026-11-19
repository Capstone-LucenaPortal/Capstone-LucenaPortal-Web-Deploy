// src/app/(admin)/admin/(shell)/dashboard/page.tsx
//
// Thin server-component wrapper: it owns the server-only `metadata` export
// (per-route <title>), which cannot live in a "use client" file, and passes
// the greeting's name down from the server's profile read, so it is in the
// first HTML. All other page content/behavior lives in the dashboard
// feature's dashboard-page.tsx.
import type { Metadata } from "next";
import { adminDisplayName } from "@/portals/admin/features/auth/lib/display-name";
import { getAdminProfile } from "@/portals/admin/features/auth/lib/profile";
import { DashboardPage } from "@/portals/admin/features/dashboard/components/dashboard-page";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function Page() {
  // The (shell) layout has already gated on this read; cache() makes it the
  // same one.
  return <DashboardPage displayName={adminDisplayName(await getAdminProfile())} />;
}
