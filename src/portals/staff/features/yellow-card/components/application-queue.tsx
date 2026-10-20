import Link from "next/link";
import { formatDate } from "@/portals/staff/lib/utils";
import { LinkTabs } from "@/portals/staff/components/ui/link-tabs";
import { QueueActivityBar } from "@/portals/staff/components/queue/queue-activity-bar";
import { countAwaitingReview } from "../lib/actions";
import { getFullName } from "../lib/get-full-name";
import { buildQueueHref, type StatusFilter } from "../lib/queue-params";
import { awaitingReviewCount, STATUS_LABELS, STATUS_ORDER } from "../lib/status";
import { DeadlineBadge } from "./deadline-badge";
import { YellowCardStatusBadge } from "./status-badge";
import type { YellowCardQueueItem, YellowCardStatus } from "../types";

interface ApplicationQueueProps {
  applications: YellowCardQueueItem[];
  counts: Record<YellowCardStatus, number>;
  status: StatusFilter;
  search: string;
}

export function ApplicationQueue({
  applications,
  counts,
  status,
  search,
}: ApplicationQueueProps) {
  const total = STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {STATUS_ORDER.map((key) => (
          <div
            key={key}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-3xl font-bold text-gray-900">{counts[key]}</p>
            <p className="mt-1 text-sm text-gray-500">{STATUS_LABELS[key]}</p>
          </div>
        ))}
      </div>

      {/*
        A plain GET form. The filter lives in the URL because the server does
        the filtering, so this needs no JavaScript, survives a refresh, and is
        linkable. The hidden field carries the active tab through a search.
      */}
      <form method="get" action="/staff/yellow-card" className="mt-6 flex max-w-md gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <label htmlFor="q" className="sr-only">
          Search applications
        </label>
        <input
          id="q"
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by ARN, applicant name, or barangay..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center rounded-md bg-lucena-blue px-4 text-sm font-medium text-white hover:bg-lucena-blue-dark"
        >
          Search
        </button>
      </form>

      <LinkTabs
        activeValue={status}
        trailing={
          /*
            The baseline is folded from the counts this page already fetched;
            the poll is a separate query. Both key off REVIEWABLE_STATUSES, which
            is what keeps the two figures from drifting.
          */
          <QueueActivityBar
            count={awaitingReviewCount(counts)}
            countAction={countAwaitingReview}
            noun="new"
          />
        }
        options={[
          { value: "all", label: "All", count: total, href: buildQueueHref({ status: "all", search }) },
          ...STATUS_ORDER.map((key) => ({
            value: key,
            label: STATUS_LABELS[key],
            count: counts[key],
            href: buildQueueHref({ status: key, search }),
          })),
        ]}
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">ARN</th>
              <th className="px-4 py-3 font-medium text-gray-500">Applicant</th>
              <th className="px-4 py-3 font-medium text-gray-500">Barangay</th>
              <th className="px-4 py-3 font-medium text-gray-500">Submitted</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Deadline</th>
              <th className="px-4 py-3 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {application.reference_number}
                </td>
                <td className="px-4 py-3 text-gray-700">{getFullName(application)}</td>
                <td className="px-4 py-3 text-gray-700">{application.barangay_name}</td>
                <td className="px-4 py-3 text-gray-700">
                  {formatDate(application.submitted_at)}
                </td>
                <td className="px-4 py-3">
                  <YellowCardStatusBadge status={application.status} />
                </td>
                <td className="px-4 py-3">
                  <DeadlineBadge
                    state={application.deadline_state}
                    dueAt={application.due_at}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/staff/yellow-card/${application.id}`}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-lucena-blue px-3 text-sm font-medium text-white hover:bg-lucena-blue-dark"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {applications.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            No applications match your search.
          </p>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Showing {applications.length} of {total} results
      </p>
    </div>
  );
}
