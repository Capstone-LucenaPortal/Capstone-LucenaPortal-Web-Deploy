// src/app/(admin)/admin/(shell)/sla-reports/page.tsx
//
// Thin server-component wrapper: this file's only job is to own the
// server-only `metadata` export (per-route <title>), which cannot live in a
// "use client" file. All actual page content/behavior lives in the
// sla feature's sla-reports-page.tsx (see that file's header for why it
// exists as a sibling rather than being merged back in here).
import type { Metadata } from "next";
import { SLAReportsPage } from "@/portals/admin/features/sla/components/sla-reports-page";

export const metadata: Metadata = {
  title: "SLA Reports",
};

export default function Page() {
  return <SLAReportsPage />;
}
