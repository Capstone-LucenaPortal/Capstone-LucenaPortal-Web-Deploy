import { createClient } from "@/shared/supabase/client";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { rows, singleRow } from "@/portals/super-staff/lib/supabase/select";
import type { HealthSample, HealthSummary, Reachability, SystemHealth } from "../types";

/** The History section draws the last 24 h of 5-minute samples. */
const TREND_HOURS = 24;

/**
 * The live snapshot. The generated return type is bare `Json`, so it is typed
 * here, once (see ../types). `null` is not an error: the RPC answers null to
 * anyone who is not a Super Staff.
 */
export async function getSystemHealth(): Promise<SystemHealth | null> {
  const data = await callRpc("super_system_health", {});
  return data as unknown as SystemHealth | null;
}

export async function listHealthSamples(): Promise<HealthSample[]> {
  const since = new Date(Date.now() - TREND_HOURS * 3600_000).toISOString();
  const data = await rows(
    createClient()
      .from("super_system_health_samples")
      // One literal: the typed select reads the column list from it.
      .select(
        "sampled_at, status, connections, email_queued, push_queued, yellow_card_status, incidents_status, lcc_status, database_status, storage_status, notifications_status, jobs_status, accounts_status",
      )
      .gte("sampled_at", since)
      .order("sampled_at", { ascending: true }),
  );
  // A sample without its timestamp cannot be placed on a time axis.
  return data.flatMap((r) =>
    r.sampled_at === null
      ? []
      : [
          {
            sampledAt: r.sampled_at,
            status: r.status,
            sections: {
              yellow_card: r.yellow_card_status,
              incidents: r.incidents_status,
              lcc: r.lcc_status,
              database: r.database_status,
              storage: r.storage_status,
              notifications: r.notifications_status,
              jobs: r.jobs_status,
              accounts: r.accounts_status,
            },
            connections: r.connections,
            emailQueued: r.email_queued,
            pushQueued: r.push_queued,
          },
        ],
  );
}

/** A one-row aggregate view, so zero rows means the gate refused: an error, not a blank. */
export async function getHealthSummary(): Promise<HealthSummary> {
  const row = await singleRow(
    createClient()
      .from("super_system_health_summary")
      .select("samples_7d, healthy_pct_7d")
      .single(),
  );
  return { samples7d: row.samples_7d, healthyPct7d: row.healthy_pct_7d };
}

/** `null` when /api/health itself cannot be reached: the app is not answering. */
export async function checkReachability(): Promise<Reachability | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Reachability;
  } catch {
    return null;
  }
}
