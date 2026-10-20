import { createClient } from "@/shared/supabase/server";
import { deriveSlaState } from "./sla";
import { getAtRiskThreshold } from "./config";
import { ACTIVE_STATUSES } from "./status";
import { readAwaitingTriageCount } from "./queries";
import type { IncidentsCardData, PreviewItem } from "@/portals/staff/features/dashboard/types";
import type { IncidentLevel, IncidentStatus } from "../types";

const PREVIEW_LIMIT = 3;

export type IncidentPreviewRow = {
  id: string;
  type_label: string | null;
  barangay_name: string | null;
  incident_level: IncidentLevel;
  is_verified: boolean | null;
  status: IncidentStatus;
  sla_armed_at: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
};

const LEVEL_TONE: Record<IncidentLevel, PreviewItem["tag"]["tone"]> = {
  critical: "critical",
  high: "high",
  medium: "neutral",
  low: "neutral",
};

/**
 * Pure. Totals are passed in rather than derived from `rows`, because `rows` is
 * only the first few — counting them would silently cap the figures at the
 * preview limit.
 */
export function buildIncidentCard({
  awaitingTriage,
  critical,
  high,
  slaBreaches,
  rows,
  now,
  threshold,
}: {
  awaitingTriage: number;
  critical: number;
  high: number;
  slaBreaches: number;
  rows: IncidentPreviewRow[];
  now: Date;
  threshold: number;
}): IncidentsCardData {
  return {
    module: "incidents",
    awaitingTriage,
    critical,
    high,
    slaBreaches,
    preview: rows.slice(0, PREVIEW_LIMIT).map((row) => {
      const state = deriveSlaState(
        { ...row, is_verified: row.is_verified ?? false },
        now,
        threshold,
      );

      return {
        id: row.id,
        label: `${row.type_label ?? "Incident"}, Brgy. ${row.barangay_name ?? "—"}`,
        // A clock that has not started says nothing useful, and it is the state
        // most incidents are in. Fall back to the level, which always does.
        tag:
          state === "breached"
            ? { text: "breached", tone: "critical" as const }
            : state === "at_risk"
              ? { text: "at risk", tone: "warning" as const }
              : {
                  text: row.incident_level,
                  tone: LEVEL_TONE[row.incident_level],
                },
      };
    }),
  };
}

/**
 * Server-only glue. Four head-only counts plus one ordered preview page. The
 * breach count cannot be a head count — "breached" is a comparison against a
 * moving clock — so it is filtered by `sla_due_at < now`, which is the same
 * thing for an unresolved incident.
 *
 * The Awaiting Triage figure is the queue's own read, not a fifth inline
 * query: it is the one the activity bar polls, so the card and the queue
 * cannot disagree about the set. It reports a failed read as null rather than
 * throwing, which lands here as the same zero the other counts fall back to.
 */
export async function getIncidentCard(): Promise<IncidentsCardData> {
  const supabase = await createClient();
  const now = new Date();
  const threshold = await getAtRiskThreshold();

  const [previewResult, awaitingTriage, criticalResult, highResult, breachResult] =
    await Promise.all([
      supabase
        .from("staff_incidents")
        .select(
          "id, type_label, barangay_name, incident_level, is_verified, status, sla_armed_at, sla_due_at, resolved_at, closed_at",
        )
        .in("status", ACTIVE_STATUSES)
        .order("sla_due_at", { ascending: true, nullsFirst: false })
        .limit(PREVIEW_LIMIT),
      readAwaitingTriageCount(supabase),
      supabase
        .from("staff_incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .eq("incident_level", "critical"),
      supabase
        .from("staff_incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .eq("incident_level", "high"),
      supabase
        .from("staff_incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .lt("sla_due_at", now.toISOString()),
    ]);

  if (previewResult.error) {
    throw new Error(
      `incidents dashboard read failed: ${previewResult.error.message}`,
    );
  }

  return buildIncidentCard({
    awaitingTriage: awaitingTriage ?? 0,
    critical: criticalResult.count ?? 0,
    high: highResult.count ?? 0,
    slaBreaches: breachResult.count ?? 0,
    rows: (previewResult.data as IncidentPreviewRow[] | null) ?? [],
    now,
    threshold,
  });
}
