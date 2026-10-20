import Link from "next/link";
import { cn } from "@/portals/staff/lib/utils";
import { LinkTabs } from "@/portals/staff/components/ui/link-tabs";
import { QueueActivityBar } from "@/portals/staff/components/queue/queue-activity-bar";
import { countAwaitingTriage } from "../lib/actions";
import { awaitingTriageCount, STATUS_LABELS, STATUS_ORDER } from "../lib/status";
import { buildQueueHref, type StatusFilter } from "../lib/queue-params";
import { IncidentStatusBadge } from "./incident-status-badge";
import { IncidentLevelBadge } from "./incident-level-badge";
import { ClosureReasonBadge } from "./closure-reason-badge";
import { DuplicateOfLink } from "./duplicate-of-link";
import { SlaIndicator } from "./sla-indicator";
import type { IncidentQueueItem, IncidentStatus } from "../types";

export function IncidentQueue({
  incidents,
  statusCounts,
  atRiskCount,
  activeStatus,
  search,
  now,
  threshold,
}: {
  incidents: IncidentQueueItem[];
  statusCounts: Record<IncidentStatus, number>;
  atRiskCount: number;
  activeStatus: StatusFilter;
  search?: string;
  now: Date;
  threshold: number;
}) {
  const total = STATUS_ORDER.reduce((sum, s) => sum + statusCounts[s], 0);
  // One figure, read once: the tile below and the activity badge's baseline
  // both report the awaiting-triage set, and folding it twice is two places to
  // miss on the day the set grows.
  const awaitingTriage = awaitingTriageCount(statusCounts);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* The figure moved to the fold; the label did not, deliberately. It is
            hand-written rather than STATUS_LABELS.open because it names the
            *set* where the label map names the *status* — the same string only
            while AWAITING_TRIAGE_STATUSES has one member, which is the
            coincidence that constant's comment exists to insist is a
            coincidence. Once the set holds two, a tile labelled after one of
            them is lying about what it counts. */}
        <SummaryCard value={awaitingTriage} label="Awaiting Triage" />
        <SummaryCard value={statusCounts.in_pool} label="In Pool · Unclaimed" />
        <SummaryCard value={atRiskCount} label="At Risk" />
        <SummaryCard value={statusCounts.in_progress} label="In Progress" />
      </div>

      {/* A GET form, so the search term lands in the URL where the server read
          can see it. The status is carried as a hidden field or the current tab
          is lost on submit. */}
      <form method="get" action="/staff/incidents" className="mt-6 flex max-w-md gap-2">
        {activeStatus !== "all" && (
          <input type="hidden" name="status" value={activeStatus} />
        )}
        <input
          type="text"
          name="q"
          aria-label="Search incidents"
          defaultValue={search ?? ""}
          placeholder="Search by reference, type, barangay, or address..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-lucena-blue px-4 text-sm font-medium text-white hover:bg-lucena-blue-dark"
        >
          Search
        </button>
      </form>

      <LinkTabs
        activeValue={activeStatus}
        trailing={
          /*
            The baseline is folded from the status counts this page already
            fetched; the poll is a separate head-only query. Both key off
            AWAITING_TRIAGE_STATUSES, which is what keeps the two figures from
            drifting.

            Whole-view, like every other figure on this screen — it is folded
            from the counts, not from the rows the active tab happens to be
            showing. And it says nothing about SLA: breach belongs to one row
            and has the At Risk card and the per-row indicator already.
          */
          <QueueActivityBar
            count={awaitingTriage}
            countAction={countAwaitingTriage}
            noun="new"
          />
        }
        options={[
          {
            value: "all",
            label: "All",
            count: total,
            href: buildQueueHref({ status: "all", search }),
          },
          ...STATUS_ORDER.map((status) => ({
            value: status,
            label: STATUS_LABELS[status],
            count: statusCounts[status],
            href: buildQueueHref({ status, search }),
          })),
        ]}
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Reference</th>
              <th className="px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 font-medium text-gray-500">Level</th>
              <th className="px-4 py-3 font-medium text-gray-500">Barangay</th>
              <th className="px-4 py-3 font-medium text-gray-500">SLA</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr
                key={incident.id}
                className={cn(
                  "border-b border-gray-100 last:border-0",
                  // An unverified report has no evidence and no running clock.
                  // Dimming it says "real, but not yet actionable" without
                  // hiding it — the mock used a separate badge column for this,
                  // which cost a column to say what the row already shows.
                  !incident.is_verified && "bg-gray-50 text-gray-500",
                )}
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {incident.reference_number}
                  <DuplicateOfLink
                    incident={incident}
                    className="mt-0.5 text-xs font-normal"
                  />
                </td>
                <td className="px-4 py-3 text-gray-700">{incident.type_label}</td>
                <td className="px-4 py-3">
                  <IncidentLevelBadge level={incident.incident_level} />
                </td>
                <td className="px-4 py-3 text-gray-700">{incident.barangay_name}</td>
                <td className="px-4 py-3">
                  <SlaIndicator incident={incident} now={now} threshold={threshold} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <IncidentStatusBadge status={incident.status} />
                    <ClosureReasonBadge reason={incident.closure_reason} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/staff/incidents/${incident.id}`}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-lucena-blue px-3 text-sm font-medium text-white hover:bg-lucena-blue-dark"
                  >
                    {incident.status === "open" ? "Triage" : "View"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            No incidents match this filter.
          </p>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Showing {incidents.length} of {total} incidents
      </p>
    </div>
  );
}

function SummaryCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}
