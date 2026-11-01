"use client";

import { useEffect, useState } from "react";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import {
  checkReachability,
  getHealthSummary,
  getSystemHealth,
  listHealthSamples,
} from "../lib/queries";
import type { HealthSample, HealthSummary, Reachability, SystemHealth } from "../types";

/** The page refreshes every 60 s while it is open. */
export const REFRESH_MS = 60_000;

export type SystemHealthData = {
  health: SystemHealth;
  /** `null` = /api/health could not be reached. */
  reachability: Reachability | null;
  samples: HealthSample[];
  summary: HealthSummary;
  /** When this load finished, for "Updated {time}". */
  loadedAt: Date;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: SystemHealthData; refreshError: string | null };

/**
 * Loads the snapshot, the 24 h samples, the 7-day summary and /api/health
 * together, then again every REFRESH_MS. A failed refresh keeps the last good
 * data on screen and says so, rather than blanking the page.
 */
export function useSystemHealth(): State {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [health, reachability, samples, summary] = await Promise.all([
          getSystemHealth(),
          checkReachability(),
          listHealthSamples(),
          getHealthSummary(),
        ]);
        if (!active) return;
        if (health === null) {
          setState({ kind: "error", message: "System Health is only available to Super Staff." });
          return;
        }
        setState({
          kind: "ready",
          data: { health, reachability, samples, summary, loadedAt: new Date() },
          refreshError: null,
        });
      } catch (e: unknown) {
        if (!active) return;
        const message = rpcErrorMessage(e, "Could not load system health.");
        setState((prev) =>
          prev.kind === "ready" ? { ...prev, refreshError: message } : { kind: "error", message },
        );
      }
    }

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return state;
}
