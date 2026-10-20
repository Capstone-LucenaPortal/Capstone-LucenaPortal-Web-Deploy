import type { Metrics, StatTile, TrendDirection } from "../types";

/**
 * Maps the eight super_metrics columns onto four tiles.
 *
 * Two null cases, and they mean different things:
 *  - the METRIC is null → there is no number to show, so the value is an em
 *    dash and no delta is claimed;
 *  - the PRIOR period is null → the current value is real but no comparison is
 *    honest, so the delta is omitted rather than rendered as "0 vs prev", which
 *    would assert no change. `at_risk_prev` is permanently in this state.
 *
 * Direction is `up` above the prior, `down` below, `flat` when equal or when
 * the prior is null. trend.ts stays neutral-toned on purpose: "backlog up"
 * being visually identical to "compliance up" is intentional until per-metric
 * sentiment is designed.
 */
function directionOf(now: number, prev: number): TrendDirection {
  if (now > prev) return "up";
  if (now < prev) return "down";
  return "flat";
}

function tile(
  label: string,
  now: number | null,
  prev: number | null,
  suffix: "" | "%",
): StatTile {
  if (now === null) {
    return { label, value: "—", direction: "flat" };
  }
  if (prev === null) {
    return { label, value: `${now}${suffix}`, direction: "flat" };
  }
  const delta = now - prev;
  return {
    label,
    value: `${now}${suffix}`,
    deltaLabel: `${delta}${suffix} vs prev`,
    direction: directionOf(now, prev),
  };
}

export function toTiles(m: Metrics): StatTile[] {
  return [
    tile("SLA Compliance", m.slaCompliancePct, m.slaCompliancePctPrev, "%"),
    tile("At-Risk Now", m.atRiskNow, m.atRiskPrev, ""),
    tile("Open Backlog", m.openBacklog, m.openBacklogPrev, ""),
    tile("Bookings (7d)", m.bookings7d, m.bookings7dPrev, ""),
  ];
}
