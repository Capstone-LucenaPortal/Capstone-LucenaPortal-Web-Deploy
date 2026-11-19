import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";

/**
 * The length of a working day, in hours, that the database turns the
 * configured processing time target into `sla_target_hours` with:
 * `processing_time_target_days × 9`, snapshotted on each application at
 * submission. This is l70a decision D5 ("THE WORKING DAY IS A FIXED 9 HOURS"),
 * the `c_working_day_hours` constant in `yc_on_submit`. Web has no other copy
 * of it. If that migration's constant changes, change this with it. It is not
 * derived from Office Hours, and must not be.
 */
const YELLOW_CARD_WORKING_DAY_HOURS = 9;

/**
 * The working-day target a caption may name for a set of Yellow Card rows, or
 * null when it must say "the target" with no number (#132).
 *
 * Each application keeps the target it was filed under, so once Super Staff
 * change `processing_time_target_days`, or with rows filed before l70a (48
 * calendar hours), the rows a figure counts can be on targets other than the
 * configured one. The configured days are named only when every row in the
 * set was scored against exactly them. An empty set names the configured
 * days, since that is the target new filings get. No config, no number.
 */
export function yellowCardTargetDays(
  rows: Pick<YellowCardRow, "sla_target_hours">[],
  configuredDays: number | null
): number | null {
  if (configuredDays === null) return null;
  const configuredHours = configuredDays * YELLOW_CARD_WORKING_DAY_HOURS;
  return rows.every((row) => row.sla_target_hours === configuredHours) ? configuredDays : null;
}
