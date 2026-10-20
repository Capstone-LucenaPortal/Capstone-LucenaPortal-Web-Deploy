// src/portals/admin/features/sla/components/compliance-trend-card.tsx
import { SlaTrendPoint } from "@/portals/admin/features/sla/types";

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { top: 14, right: 10, bottom: 22, left: 34 };

export function ComplianceTrendCard({
  subtitle,
  points,
  targetPct,
}: {
  subtitle: string;
  points: SlaTrendPoint[];
  targetPct: number;
}) {
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  // A point with compliancePct: null (a bucket with zero SCOREABLE incidents
  // — see SlaTrendPoint's doc comment in src/portals/admin/lib/types.ts) has nothing plottable
  // on a compliance-percentage axis: there is no honest y-coordinate for it,
  // the same reason it renders "—" everywhere else rather than a fabricated
  // 0%. `plottable` carries only the points this chart can actually draw a
  // dot/line-segment for, each still tagged with its ORIGINAL index into
  // `points` so its x-position lines up with its month label below (that
  // labels loop iterates the full, unfiltered `points` list).
  const plottable = points
    .map((point, index) => ({ ...point, index }))
    .filter(
      (point): point is typeof point & { compliancePct: number } => point.compliancePct !== null
    );

  const minCompliance = Math.min(...plottable.map((point) => point.compliancePct), targetPct);
  const yMin = Math.max(0, Math.floor((minCompliance - 2) / 5) * 5);

  const x = (index: number) =>
    points.length === 1
      ? PAD.left + innerWidth / 2
      : PAD.left + (index / (points.length - 1)) * innerWidth;
  const y = (value: number) => PAD.top + (1 - (value - yMin) / (100 - yMin)) * innerHeight;

  const gridLevels: number[] = [];
  for (let level = Math.ceil(yMin / 10) * 10; level <= 100; level += 10) {
    gridLevels.push(level);
  }

  // Segments of CONSECUTIVE plottable points (by original index), so the
  // polyline breaks across a null-compliance gap instead of drawing a false
  // connecting line straight across a month with no scoreable data.
  const segments: (typeof plottable)[] = [];
  for (const point of plottable) {
    const currentSegment = segments[segments.length - 1];
    const previousPoint = currentSegment?.[currentSegment.length - 1];
    if (previousPoint && previousPoint.index === point.index - 1) {
      currentSegment.push(point);
    } else {
      segments.push([point]);
    }
  }

  const totalViolations = points.reduce((sum, point) => sum + point.violations, 0);
  const worst = Math.max(...points.map((point) => point.violations));
  const worstLabels = points
    .filter((point) => point.violations === worst)
    .map((point) => point.label);
  const worstLabel =
    worst === 0
      ? "none"
      : `${worstLabels.join(", ")} (${worst}${worstLabels.length > 1 ? " each" : ""})`;

  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  return (
    <section className="rounded-none border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Compliance trend</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-4 h-52 w-full"
        role="img"
        aria-label={`SLA compliance trend, ${subtitle}`}
      >
        {gridLevels.map((level) => (
          <g key={level}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(level)}
              y2={y(level)}
              stroke="#f3f4f6"
            />
            <text
              x={PAD.left - 6}
              y={y(level)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-400 text-[10px]"
            >
              {level}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(targetPct)}
          y2={y(targetPct)}
          stroke="#9ca3af"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <text
          x={WIDTH - PAD.right}
          y={y(targetPct) - 5}
          textAnchor="end"
          className="fill-gray-500 text-[10px] font-medium"
        >
          Target {targetPct}%
        </text>

        {segments.map((segment, segmentIndex) => (
          <polyline
            key={segmentIndex}
            fill="none"
            stroke="#1e40af"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={segment.map((point) => `${x(point.index)},${y(point.compliancePct)}`).join(" ")}
          />
        ))}

        {plottable.map((point) => (
          <g key={point.label}>
            <circle cx={x(point.index)} cy={y(point.compliancePct)} r={9} fill="transparent" />
            <circle
              cx={x(point.index)}
              cy={y(point.compliancePct)}
              r={3}
              fill={point.compliancePct < targetPct ? "#dc2626" : "#1e40af"}
            />
            <title>
              {`${point.label}: ${point.compliancePct}% compliance · ${point.violations} violation${point.violations === 1 ? "" : "s"}`}
            </title>
          </g>
        ))}

        {points.map((point, index) =>
          index % labelStep === 0 || index === points.length - 1 ? (
            <text
              key={point.label}
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor="middle"
              className="fill-gray-400 text-[10px]"
            >
              {point.label}
            </text>
          ) : null
        )}
      </svg>

      {/* The SVG's role="img" aria-label carries no numbers — a screen
          reader announces it as one opaque image. This table is the actual
          data alternative: every point's full figures, visually hidden but
          present in the accessible tree via the standard sr-only pattern
          already used elsewhere in this codebase (see
          src/portals/admin/features/incidents/components/barangay-reports-table.tsx). */}
      <table className="sr-only">
        <caption>{`Compliance trend data, ${subtitle}`}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Compliance</th>
            <th scope="col">Violations</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{`${point.compliancePct}%`}</td>
              <td>{point.violations}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-xs text-gray-600">
        <span>
          Total violations: <strong className="text-gray-900">{totalViolations}</strong>
        </span>
        <span>
          Worst: <strong className="text-gray-900">{worstLabel}</strong>
        </span>
      </div>
    </section>
  );
}
