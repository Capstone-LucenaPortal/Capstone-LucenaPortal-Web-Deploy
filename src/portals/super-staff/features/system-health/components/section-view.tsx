"use client";

import { Fragment } from "react";
import Link from "next/link";
import { cn, formatDate, formatDateTime } from "@/portals/super-staff/lib/utils";
import type { SystemHealthData } from "../hooks/use-system-health";
import { formatBytes, formatMs, formatSeconds } from "../lib/format";
import { sectionHref } from "../lib/routes";
import {
  RESPONSE_CRITICAL_MS,
  RESPONSE_WARNING_MS,
  sectionInfo,
  sectionStatuses,
  type SectionKey,
  type SectionStatus,
} from "../lib/status";
import type { ServiceSections } from "../types";
import { AccountsPanel } from "./accounts-panel";
import { ChecksPanel } from "./checks-panel";
import { DatabaseActivityPanel, DeadRowsPanel, NotMeasuredNote } from "./database-panels";
import { DeliveryPanel, FailureReasonsPanel } from "./delivery-panel";
import { JobsPanel, RunHistoryPanel } from "./jobs-panel";
import { Panel, STATUS_WORD, StatusPill, TONE_STYLE } from "./panel";
import { PerformancePanel } from "./performance-panel";
import { ReachabilityPanel } from "./reachability-panel";
import { BucketsPanel, DatabaseSizePanel } from "./size-panels";
import { StatusStrip } from "./status-strip";
import { useSystemHealthData } from "./system-health-shell";
import { TrendPanel } from "./trend-panel";

type Threshold = [label: string, value: string];

/**
 * What a section page shows below its checks and status strip: its panels, then
 * its thresholds. `notMeasured` adds the line naming what only Supabase's logs
 * hold.
 */
type SectionBody = { lead: string; panels: React.ReactNode; thresholds: Threshold[]; notMeasured?: boolean };

/** "over 80% / over 95%": a warning / critical pair of percentages. */
function overPct(warning: number, critical: number): string {
  return `over ${warning}% / over ${critical}%`;
}

/** The two thresholds every Citizen service shares: the fault count that grades, and the receipt grace. */
function serviceThresholds({ detail }: ServiceSections[keyof ServiceSections]): Threshold[] {
  const { fault_count, receipt_grace_seconds } = detail.thresholds;
  const since = detail.receipts_checked_since;
  return [
    ["Faulty items", `${fault_count} or more grades the check (critical or warning, per check)`],
    [
      "Acknowledgement Receipt",
      `none ${formatSeconds(receipt_grace_seconds)} after submission (warning)${
        since === null ? "" : `, for submissions since ${formatDate(since)}`
      }`,
    ],
  ];
}

/** Uploads started and never finished, past this age: counted, never graded. */
function abandonedUploads(seconds: number): Threshold {
  return ["Abandoned uploads", `older than ${formatSeconds(seconds)} (not graded)`];
}

function sectionBody(key: SectionKey, { health, reachability, samples }: SystemHealthData): SectionBody {
  const t = health.thresholds;
  switch (key) {
    case "yellow_card": {
      const yellowCard = health.sections.yellow_card;
      const { notice_grace_seconds, abandoned_upload_seconds } = yellowCard.detail.thresholds;
      return {
        lead: "Yellow Card applications: deadlines, cards and receipts the software should have moved.",
        panels: null,
        thresholds: [
          ...serviceThresholds(yellowCard),
          ["At Risk or Overdue notice", `missed by over ${formatSeconds(notice_grace_seconds)} (warning)`],
          abandonedUploads(abandoned_upload_seconds),
        ],
      };
    }
    case "incidents": {
      const incidents = health.sections.incidents;
      const { lifecycle_grace_seconds } = incidents.detail.thresholds;
      return {
        lead: "Citizen reports: verification, pools, SLA clocks and the lifecycle sweep.",
        panels: null,
        thresholds: [
          ...serviceThresholds(incidents),
          [
            "Lifecycle sweep",
            `over ${formatSeconds(lifecycle_grace_seconds)} past the closing or confirmation window (warning)`,
          ],
        ],
      };
    }
    case "lcc": {
      const lcc = health.sections.lcc;
      const { hold_grace_seconds, abandoned_upload_seconds } = lcc.detail.thresholds;
      return {
        lead: "Lucena Convention Center bookings: holds, the dates they block, and receipts.",
        panels: null,
        thresholds: [
          ...serviceThresholds(lcc),
          [
            "Expired hold",
            `still blocking the hall over ${formatSeconds(hold_grace_seconds)} after it expired (critical)`,
          ],
          abandonedUploads(abandoned_upload_seconds),
        ],
      };
    }
    case "database": {
      const db = health.sections.database;
      const dt = db.detail.thresholds;
      return {
        lead: "Whether the database answers, how fast, and how close it is to its limits.",
        panels: (
          <>
            <ReachabilityPanel reachability={reachability} />
            <DatabaseSizePanel database={db} />
            <DatabaseActivityPanel detail={db.detail} />
            <DeadRowsPanel detail={db.detail} />
            <TrendPanel
              title="Open connections, last 24 h"
              samples={samples}
              lines={[{ key: "connections", name: "Open connections", color: "#1e40af" }]}
            />
            <PerformancePanel performance={health.performance} />
          </>
        ),
        notMeasured: true,
        thresholds: [
          ["Response time", `over ${formatMs(RESPONSE_WARNING_MS)} / over ${formatMs(RESPONSE_CRITICAL_MS)}`],
          [
            "Size",
            `${overPct(dt.capacity_warning_pct, dt.capacity_critical_pct)} of ${formatBytes(dt.database_limit_bytes)} (${t.plan} plan)`,
          ],
          [
            "Connections",
            `${overPct(dt.capacity_warning_pct, dt.capacity_critical_pct)} of the ${db.detail.connections.limit} allowed`,
          ],
          ["Cache hit ratio", `below ${dt.cache_hit_warning_pct}% / below ${dt.cache_hit_critical_pct}%`],
          [
            "Oldest open transaction",
            `over ${formatSeconds(dt.transaction_warning_seconds)} / over ${formatSeconds(dt.transaction_critical_seconds)}`,
          ],
          [
            "Lock waits",
            `${dt.lock_waits_warning} or more waiting over ${formatSeconds(dt.lock_wait_seconds)} (warning)`,
          ],
        ],
      };
    }
    case "storage": {
      const storage = health.sections.storage;
      const st = storage.detail.thresholds;
      return {
        lead: "The files the services keep: photos, documents and receipts.",
        panels: <BucketsPanel storage={storage} />,
        thresholds: [
          [
            "Quota",
            `${overPct(st.capacity_warning_pct, st.capacity_critical_pct)} of ${formatBytes(st.storage_limit_bytes)} (${t.plan} plan)`,
          ],
          ["Missing files", `${st.missing_objects_warning} or more (warning)`],
        ],
      };
    }
    case "notifications": {
      const { detail } = health.sections.notifications;
      const nt = detail.thresholds;
      return {
        lead: "Email, push and in-app delivery: counts only, never who they went to.",
        panels: (
          <>
            <DeliveryPanel detail={detail} />
            <FailureReasonsPanel detail={detail} />
            <TrendPanel
              title="Queued notifications, last 24 h"
              samples={samples}
              lines={[
                { key: "emailQueued", name: "Email", color: "#1e40af" },
                { key: "pushQueued", name: "Push", color: "#ea580c" },
              ]}
            />
          </>
        ),
        thresholds: [
          [
            "Oldest queued",
            `over ${formatSeconds(nt.queued_warning_seconds)} / over ${formatSeconds(nt.queued_critical_seconds)}`,
          ],
          ["Failed or bounced", `${nt.delivery_failures_warning} or more in 24 h, per channel (warning)`],
        ],
      };
    }
    case "jobs": {
      const jt = health.sections.jobs.detail.thresholds;
      return {
        lead: "The scheduled jobs that sweep, send, sample and purge in the background.",
        panels: (
          <>
            <JobsPanel sections={health.sections} />
            <RunHistoryPanel jobs={health.sections.jobs} />
          </>
        ),
        thresholds: [
          ["Job overdue", `no run in ${jt.job_overdue_factor}× its interval (warning)`],
          [
            "Run history",
            `kept ${formatSeconds(jt.run_history_keep_seconds)} (warning when older runs remain)`,
          ],
        ],
      };
    }
    case "accounts": {
      const accounts = health.sections.accounts;
      const at = accounts.detail.thresholds;
      return {
        lead: "Staff signing in to the Portals, and the accounts that keep the system administrable.",
        panels: <AccountsPanel accounts={accounts} />,
        notMeasured: true,
        thresholds: [
          [
            "Password-recovery requests",
            `${at.recovery_requests_warning} or more in ${formatSeconds(at.recovery_window_seconds)} (warning)`,
          ],
          ["Super-staff accounts", `${at.super_staff_warning_at_most} or fewer signed in (warning)`],
        ],
      };
    }
  }
}

/** The cut-offs this section's grades use, read from the snapshot except response time. */
function ThresholdsPanel({ thresholds }: { thresholds: Threshold[] }) {
  return (
    <Panel title="Thresholds" summary={<span>Warning / critical</span>}>
      <dl className="divide-y divide-gray-100 text-sm">
        {thresholds.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-5 py-2">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-right text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** "Affected by Storage, Background jobs", each linking to that component's page. */
function AffectedBy({ section }: { section: SectionStatus }) {
  if (section.affectedBy.length === 0) return null;
  return (
    <p className={cn("mt-2 text-sm font-medium", TONE_STYLE[section.status].text)}>
      Affected by{" "}
      {section.affectedBy.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && ", "}
          <Link href={sectionHref(key)} className="underline underline-offset-2">
            {sectionInfo(key).label}
          </Link>
        </Fragment>
      ))}
    </p>
  );
}

/** "Last activity 20 min ago (Oct 31, 2026, 1:40 PM)": the service's latest submission, as of this reading. */
function lastActivity(at: string | null, now: Date): string {
  if (at === null) return "No activity yet";
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(at).getTime()) / 1000));
  return `Last activity ${formatSeconds(seconds)} ago (${formatDateTime(at)})`;
}

/**
 * One section's page. Every section uses this template: a status header
 * (with what a service is affected by and its last activity), the checks
 * table, the section's 24 h status strip, its panels, then its own thresholds.
 */
export function SectionView({ section }: { section: SectionKey }) {
  const data = useSystemHealthData();
  const current = sectionStatuses(data.health, data.reachability).find((s) => s.key === section)!;
  const { label, status } = current;
  const { lead, panels, thresholds, notMeasured } = sectionBody(section, data);
  const snapshot = data.health.sections[section];

  return (
    <div className="space-y-6">
      <section aria-label="Section status" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{label}</h2>
          <p className="mt-1 text-sm text-gray-500">{lead}</p>
          <AffectedBy section={current} />
          {snapshot.group === "service" && (
            <p className="mt-1 text-sm text-gray-500">{lastActivity(snapshot.last_activity_at, data.loadedAt)}</p>
          )}
        </div>
        <StatusPill tone={status}>{STATUS_WORD[status]}</StatusPill>
      </section>
      <ChecksPanel checks={data.health.sections[section].checks} />
      <StatusStrip section={section} label={label} samples={data.samples} />
      {panels}
      {notMeasured && <NotMeasuredNote />}
      <ThresholdsPanel thresholds={thresholds} />
    </div>
  );
}
