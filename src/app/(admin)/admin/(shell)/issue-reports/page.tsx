// src/app/(admin)/admin/(shell)/issue-reports/page.tsx
//
// Thin server-component wrapper: this file's only job is to own the
// server-only `metadata` export (per-route <title>), which cannot live in a
// "use client" file. All actual page content/behavior lives in the
// incidents feature's issue-reports-page.tsx (see that file's header for why
// it exists as a sibling rather than being merged back in here).
import type { Metadata } from "next";
import { Suspense } from "react";
import { IssueReportsPage } from "@/portals/admin/features/incidents/components/issue-reports-page";

export const metadata: Metadata = {
  title: "Incident Reports",
};

// The page reads SLA Reports' filter with useSearchParams (#127). A
// production build refuses a prerendered page that does so outside a
// Suspense boundary (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <IssueReportsPage />
    </Suspense>
  );
}
