"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/portals/super-staff/components/ui/card";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { formatDate } from "@/portals/super-staff/lib/utils";
import { listRecentAuditEntries } from "@/portals/super-staff/features/audit-log/lib/queries";
import { getMetrics } from "../lib/queries";
import { toTiles } from "../lib/tiles";
import type { MonitoringSnapshot } from "../types";
import { StatTile } from "./stat-tile";

/** The strip shows the five latest Configuration-area entries. */
const RECENT_LIMIT = 5;

export function MonitoringView() {
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getMetrics(), listRecentAuditEntries("configuration", RECENT_LIMIT)])
      .then(([metrics, recentConfigChanges]) => {
        if (!active) return;
        setSnapshot({ tiles: toTiles(metrics), recentConfigChanges });
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(rpcErrorMessage(e, "Could not load monitoring."));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">Monitoring</h1>
        <p className="text-gray-500 mt-2">
          How recent configuration changes are landing. Admin owns the full
          dashboards.
        </p>
      </div>

      {error !== null ? (
        <p className="mt-6 text-sm text-red-500">{error}</p>
      ) : snapshot === null ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {snapshot.tiles.map((tile) => (
              <StatTile key={tile.label} tile={tile} />
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent configuration changes</CardTitle>
              <p className="text-xs text-gray-500">
                Pulled from the audit log (Configuration area) — correlate a
                change with a metric movement.
              </p>
            </CardHeader>
            <CardContent>
              {snapshot.recentConfigChanges.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No recent configuration changes.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {snapshot.recentConfigChanges.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-baseline gap-4 py-3 text-sm first:pt-0 last:pb-0"
                    >
                      <span className="w-28 shrink-0 text-gray-500 tabular-nums">
                        {formatDate(c.timestamp)}
                      </span>
                      <span className="flex-1 text-gray-700">{c.change}</span>
                      <span className="text-gray-500">— {c.actor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
