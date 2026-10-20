// src/portals/admin/components/ui/monthly-bar-card.tsx
import { MonthlyReportCount } from "@/portals/admin/lib/aggregate";

export function MonthlyBarCard({
  title,
  subtitle,
  months,
  note,
  noteTone = "positive",
  // Was false: bars showed no visible number at all, only a mouse-only
  // `title=` tooltip. Defaulting to true gives every caller a visible count
  // for free, which is also trivially available to screen readers as a
  // normal text node (no extra ARIA required for that half of the fix).
  showCounts = true,
}: {
  title: string;
  subtitle: string;
  months: MonthlyReportCount[];
  note?: string;
  noteTone?: "positive" | "negative";
  showCounts?: boolean;
}) {
  const max = Math.max(1, ...months.map((entry) => entry.count));
  const highlightClass = noteTone === "negative" ? "bg-red-500" : "bg-blue-400";
  const noteClass = "text-gray-600";
  const notePath =
    noteTone === "negative"
      ? "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      : "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5";

  return (
    <section className="flex flex-col rounded-none border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{subtitle}</p>

      <div className="mt-auto flex items-end gap-2 pt-4" aria-label={title}>
        {months.map((entry) => (
          <div key={entry.month} className="flex flex-1 flex-col items-center gap-1">
            {showCounts && (
              <span className="text-xs font-semibold tabular-nums text-gray-900">
                {entry.count.toLocaleString()}
              </span>
            )}
            <div
              title={`${entry.month}: ${entry.count.toLocaleString()}`}
              role="img"
              aria-label={`${entry.month}: ${entry.count.toLocaleString()}`}
              className={`w-full ${entry.spike ? highlightClass : "bg-blue-800"}`}
              style={{ height: `${Math.round((entry.count / max) * 72)}px` }}
            />
            <span className="text-xs font-medium text-gray-500">{entry.month}</span>
          </div>
        ))}
      </div>

      {note && (
        <p className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${noteClass}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0" aria-hidden>
            <path d={notePath} />
          </svg>
          {note}
        </p>
      )}
    </section>
  );
}
