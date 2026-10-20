import type { TrendDirection } from "../types";

export type TrendPresentation = {
  /** ▲ / ▼ / ▬ — direction only; never good/bad. */
  glyph: string;
  /** Screen-reader text for the direction, e.g. "up". */
  srLabel: string;
};

const PRESENTATION: Record<TrendDirection, TrendPresentation> = {
  up: { glyph: "▲", srLabel: "up" },
  down: { glyph: "▼", srLabel: "down" },
  flat: { glyph: "▬", srLabel: "no change" },
};

/**
 * Maps a trend direction to its glyph + accessible label. The glyph conveys
 * direction ONLY — never good/bad — because a raw direction carries no
 * sentiment (a falling At-Risk count is good; a rising Open Backlog is not).
 * The delta is therefore rendered in a neutral tone; per-metric sentiment
 * coloring is deferred to Slice G, which has the real metric semantics.
 */
export function trendPresentation(direction: TrendDirection): TrendPresentation {
  return PRESENTATION[direction];
}
