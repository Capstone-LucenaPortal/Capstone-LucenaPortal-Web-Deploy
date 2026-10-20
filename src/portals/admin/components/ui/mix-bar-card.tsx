// src/portals/admin/components/ui/mix-bar-card.tsx
export interface MixSlice {
  label: string;
  count: number;
  chipClass?: string;
  barClass: string;
}

export function MixBarCard({
  title,
  subtitle,
  slices,
  labelStyle = "chip",
}: {
  title: string;
  subtitle: string;
  slices: MixSlice[];
  labelStyle?: "chip" | "plain";
}) {
  const max = Math.max(1, ...slices.map((slice) => slice.count));

  return (
    <section className="rounded-none border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{subtitle}</p>
      <div className="mt-4 space-y-3">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-3">
            <span
              className={
                labelStyle === "plain"
                  ? "w-32 shrink-0 truncate text-sm font-medium text-gray-800"
                  : `w-32 shrink-0 px-2 py-0.5 text-center text-xs font-medium ${slice.chipClass ?? ""}`
              }
            >
              {slice.label}
            </span>
            <div
              className="h-2 flex-1 bg-gray-100"
              role="img"
              aria-label={`${slice.label}: ${slice.count.toLocaleString()}`}
            >
              <div
                className={`h-2 ${slice.barClass}`}
                style={{ width: `${(slice.count / max) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-sm font-semibold tabular-nums text-gray-900">
              {slice.count}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
