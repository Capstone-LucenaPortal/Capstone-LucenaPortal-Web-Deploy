import { trendPresentation } from "../lib/trend";
import type { StatTile as StatTileData } from "../types";

/**
 * One read-only metric tile (design spec §5.2): a figure, its label, and a
 * movement-vs-prior-period delta. The delta stays on a neutral tone — the
 * glyph shows direction only, not good/bad (see ../lib/trend).
 *
 * A tile with no `deltaLabel` renders NO delta row at all. Showing the glyph
 * alone, or "0 vs prev", would assert a comparison the data cannot support.
 */
export function StatTile({ tile }: { tile: StatTileData }) {
  const { glyph, srLabel } = trendPresentation(tile.direction);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-gray-900 tabular-nums">
        {tile.value}
      </p>
      <p className="mt-1 text-sm text-gray-500">{tile.label}</p>
      {tile.deltaLabel !== undefined && (
        <p className="mt-2 flex items-center gap-1 text-xs text-gray-500 tabular-nums">
          <span aria-hidden="true">{glyph}</span>
          <span className="sr-only">{srLabel}, </span>
          {tile.deltaLabel}
        </p>
      )}
    </div>
  );
}
