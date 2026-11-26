"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SYSTEM_ISSUES_HREF } from "@/portals/super-staff/features/system-health/lib/routes";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { formatDateTime } from "@/portals/super-staff/lib/utils";
import { getSystemIssueSummary } from "../lib/system-issue-queries";
import type { SystemIssueSummary } from "../types";

/**
 * System Health's General card for System issues, under the status overview.
 *
 * Ungraded on purpose (ADR 0013): a person's report is a lead for IT, not a
 * measurement, so it never changes a section's status, General's, the banner
 * or the sidebar dot. It takes no part in the page's grading and reads its
 * own figures, from super_system_issues_summary.
 *
 * `refreshKey` changes whenever the host page refreshes; the figures reload with it.
 */
export function UserReportsCard({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<SystemIssueSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSystemIssueSummary()
      .then((s) => {
        if (active) {
          setSummary(s);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(rpcErrorMessage(e, "Could not load the user reports."));
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <section aria-labelledby="user-reports" className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="user-reports" className="text-lg font-semibold text-gray-900">
            User reports
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            System issues people reported. Not graded: they never change a status on this page.
          </p>
        </div>
        <Link href={SYSTEM_ISSUES_HREF} className="text-sm font-semibold text-lucena-blue hover:underline">
          Open System issues →
        </Link>
      </div>
      {error !== null ? (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      ) : summary === null ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
          <span>
            Open: <strong className="text-gray-900">{summary.open}</strong>
          </span>
          <span>
            High priority: <strong className="text-gray-900">{summary.highOpen}</strong>
          </span>
          <span>
            Not yet prioritised: <strong className="text-gray-900">{summary.unprioritisedOpen}</strong>
          </span>
          <span>
            Oldest open:{" "}
            <strong className="text-gray-900">
              {summary.oldestOpenAt === null ? "none" : formatDateTime(summary.oldestOpenAt)}
            </strong>
          </span>
        </div>
      )}
    </section>
  );
}
