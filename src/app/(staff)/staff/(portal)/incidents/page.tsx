import { IncidentQueue } from "@/portals/staff/features/incidents/components/incident-queue";
import { getAtRiskThreshold } from "@/portals/staff/features/incidents/lib/config";
import {
  getAtRiskCount,
  getIncidentQueue,
  getIncidentStatusCounts,
} from "@/portals/staff/features/incidents/lib/queries";
import { parseStatusFilter } from "@/portals/staff/features/incidents/lib/queue-params";

export default async function IncidentsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const activeStatus = parseStatusFilter(status);

  // One clock for the whole page, so every row agrees what time it is — and so
  // does the At Risk card above them, which counts against this same moment.
  const now = new Date();

  // Started, not awaited. The threshold is a one-row config read that only the
  // at-risk count depends on, so awaiting it here would hold up the queue and
  // the status counts as well. It is chained into the fan-out instead, and the
  // settled promise is awaited afterwards for the prop the table still needs.
  // The obvious tidy-up — awaiting it first — reintroduces exactly that stall.
  // Nothing is left floating: the `.then` below attaches a handler, so however
  // this read ends it is a Promise.all the page already awaits that sees it.
  const thresholdRead = getAtRiskThreshold();

  const [incidents, statusCounts, atRiskCount] = await Promise.all([
    getIncidentQueue({ status: activeStatus, search: q }),
    getIncidentStatusCounts(),
    thresholdRead.then((t) => getAtRiskCount(t, now)),
  ]);
  const threshold = await thresholdRead; // already settled

  return (
    <div>
      <h1 className="text-3xl font-bold text-lucena-blue">Incident Triage Queue</h1>
      <p className="mt-2 text-gray-500">
        Route incoming incident reports to the right department and track field
        progress.
      </p>
      <div className="mt-6">
        <IncidentQueue
          incidents={incidents}
          statusCounts={statusCounts}
          atRiskCount={atRiskCount}
          activeStatus={activeStatus}
          search={q}
          now={now}
          threshold={threshold}
        />
      </div>
    </div>
  );
}
