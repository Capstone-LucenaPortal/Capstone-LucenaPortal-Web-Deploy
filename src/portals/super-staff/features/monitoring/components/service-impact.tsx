"use client";

import { useEffect, useState } from "react";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { getMetrics } from "../lib/queries";
import { toTiles } from "../lib/tiles";
import type { StatTile as StatTileData } from "../types";
import { StatTile } from "./stat-tile";

/**
 * The four super_metrics tiles, at the foot of System Health. They are service
 * numbers — Admin owns and is measured against them — shown here so a Super
 * Staff can judge whether a configuration change landed well.
 *
 * `refreshKey` changes whenever the host page refreshes; the tiles reload with it.
 */
export function ServiceImpact({ refreshKey }: { refreshKey: number }) {
  const [tiles, setTiles] = useState<StatTileData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMetrics()
      .then((metrics) => {
        if (active) setTiles(toTiles(metrics));
      })
      .catch((e: unknown) => {
        if (active) setError(rpcErrorMessage(e, "Could not load the service numbers."));
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <section aria-labelledby="service-impact" className="rounded-lg border border-dashed border-gray-300 p-5">
      <h2 id="service-impact" className="text-lg font-semibold text-gray-900">
        Service impact
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Service numbers owned by Admin, shown here so you can judge a configuration change.
      </p>
      {error !== null ? (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      ) : tiles === null ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {tiles.map((tile) => (
            <StatTile key={tile.label} tile={tile} />
          ))}
        </div>
      )}
    </section>
  );
}
