import { ApplicationQueue } from "@/portals/staff/features/yellow-card/components/application-queue";
import {
  getYellowCardQueue,
  getYellowCardStatusCounts,
} from "@/portals/staff/features/yellow-card/lib/queries";
import { parseStatusFilter } from "@/portals/staff/features/yellow-card/lib/queue-params";

export default async function YellowCardQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: rawStatus, q } = await searchParams;
  const status = parseStatusFilter(rawStatus);
  const search = q?.trim() ?? "";

  const [applications, counts] = await Promise.all([
    getYellowCardQueue({ status, search }),
    getYellowCardStatusCounts(),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-lucena-blue">Yellow Card Applications</h1>
      <p className="text-gray-500 mt-2">
        Review Yellow Card applications submitted by residents of Lucena City.
      </p>
      <div className="mt-6">
        <ApplicationQueue
          applications={applications}
          counts={counts}
          status={status}
          search={search}
        />
      </div>
    </div>
  );
}
