import { reachabilityStatus } from "../lib/status";
import type { Reachability } from "../types";
import { Panel } from "./panel";

/** From GET /api/health; `null` means that route itself did not answer. */
export function ReachabilityPanel({ reachability }: { reachability: Reachability | null }) {
  return (
    <Panel
      id="reachability"
      title="Reachability and response time"
      status={reachabilityStatus(reachability)}
    >
      <div className="px-5 pb-4">
        {reachability === null ? (
          <p className="text-sm text-red-700">The health check did not answer: the app may be down.</p>
        ) : (
          <>
            <p className="text-4xl font-bold tabular-nums text-gray-900">
              {reachability.ms}
              <span className="ml-1 text-base font-normal text-gray-500">ms round trip</span>
            </p>
            <dl className="mt-3 flex gap-6 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-gray-500">App</dt>
                <dd className="font-medium">{reachability.ok ? "Reachable" : "Down"}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-gray-500">Database</dt>
                <dd className={reachability.db_ok ? "font-medium" : "font-medium text-red-700"}>
                  {reachability.db_ok ? "Reachable" : "Down"}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </Panel>
  );
}
