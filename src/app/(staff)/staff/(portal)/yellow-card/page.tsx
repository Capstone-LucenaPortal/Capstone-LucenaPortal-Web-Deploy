import { isAssigned } from "@/portals/staff/features/auth/lib/module-gate";
import { NotYourModule } from "@/portals/staff/features/auth/components/not-your-module";
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
  // Before anything else, so a refused account fires no Yellow Card read.
  if (!(await isAssigned("yellow-card"))) return <NotYourModule module="yellow-card" />;

  const { status: rawStatus, q } = await searchParams;
  const status = parseStatusFilter(rawStatus);
  const search = q?.trim() ?? "";

  const [queue, counts] = await Promise.all([
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
          applications={queue.items}
          matchCount={queue.matchCount}
          counts={counts}
          status={status}
          search={search}
        />
      </div>
    </div>
  );
}
