import { createClient, type Db } from "@/shared/supabase/server";
import { parseDeadlineState, type DeadlineState } from "./deadline";
import { getFullName } from "./get-full-name";
import { REVIEWABLE_STATUSES } from "./status";
import type { YellowCardCardData } from "@/portals/staff/features/dashboard/types";

const PREVIEW_LIMIT = 3;

export type PreviewRow = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  submitted_at: string;
  due_at: string | null;
  deadline_state: string | null;
};

/**
 * Red for Overdue, amber for At risk — the queue badge's colours, so a tag
 * means the same thing on both screens. A stopped clock has no state.
 */
const TONE: Record<DeadlineState, "critical" | "warning" | "neutral"> = {
  overdue: "critical",
  at_risk: "warning",
  on_track: "neutral",
};

const MS_PER_DAY = 86_400_000;

export function waitingLabel(submittedAt: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(submittedAt).getTime()) / MS_PER_DAY);
  return days < 1 ? "today" : `${days}d waiting`;
}

/**
 * Pure. Totals are passed in rather than derived from `rows`, because `rows` is
 * only the first few — counting them would silently cap the figure at the
 * preview limit.
 */
export function buildYellowCardCard({
  pending,
  atRisk,
  overdue,
  rows,
  now,
}: {
  pending: number;
  atRisk: number;
  overdue: number;
  rows: PreviewRow[];
  now: Date;
}): YellowCardCardData {
  return {
    module: "yellow-card",
    pending,
    atRisk,
    overdue,
    preview: rows.slice(0, PREVIEW_LIMIT).map((row) => {
      const state = parseDeadlineState(row.deadline_state);
      return {
        id: row.id,
        label: getFullName(row),
        tag: {
          text: waitingLabel(row.submitted_at, now),
          tone: state ? TONE[state] : ("neutral" as const),
        },
      };
    }),
  };
}

/**
 * Server-only glue. Three requests: one for the ordered preview page carrying
 * an exact total, and one head-only count each of the Overdue and At risk
 * subsets. The two counts filter on the database's deadline_state (l80) rather
 * than comparing due_at to this server's clock, so the card and the queue
 * badge share one definition.
 */
export async function getYellowCardCard(db?: Db): Promise<YellowCardCardData> {
  const supabase = db ?? await createClient();
  const now = new Date();

  const countState = (state: DeadlineState) =>
    supabase
      .from("staff_yellow_card_queue")
      .select("id", { count: "exact", head: true })
      .in("status", REVIEWABLE_STATUSES)
      .eq("deadline_state", state);

  const [previewResult, overdueResult, atRiskResult] = await Promise.all([
    supabase
      .from("staff_yellow_card_queue")
      .select(
        "id, first_name, middle_name, last_name, suffix, submitted_at, due_at, deadline_state",
        { count: "exact" },
      )
      .in("status", REVIEWABLE_STATUSES)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(PREVIEW_LIMIT),
    countState("overdue"),
    countState("at_risk"),
  ]);

  if (previewResult.error) {
    throw new Error(
      `yellow card dashboard read failed: ${previewResult.error.message}`,
    );
  }

  return buildYellowCardCard({
    pending: previewResult.count ?? 0,
    atRisk: atRiskResult.count ?? 0,
    overdue: overdueResult.count ?? 0,
    rows: (previewResult.data as PreviewRow[] | null) ?? [],
    now,
  });
}
