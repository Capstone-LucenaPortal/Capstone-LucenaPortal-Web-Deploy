// src/portals/admin/components/ui/kpi-tile.tsx
import { ReactNode } from "react";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  // A small, always-shown explanatory line (e.g. "12 of 340 scoreable
  // (pending/unverified excluded)") — independent of `note`, which is the
  // compare-toggle-gated delta and disappears when compare is off. Use
  // `caption` for a fact about `value` itself that should stay visible
  // regardless of the compare toggle. See the SLA Reports "Responses" tile.
  caption?: ReactNode;
  // ReactNode, not string: a loading state passes a <Skeleton /> placeholder
  // here rather than "Loading…" text (Admin Portal Fix Plan, Task 4.3).
  note?: ReactNode;
  noteTone: "positive" | "negative" | "neutral";
  surface?: "solid" | "raised";
}

export function KpiTile({ label, value, caption, note, noteTone, surface = "raised" }: KpiTileProps) {
  const noteClass = noteTone === "neutral" ? "text-gray-500" : "text-gray-600";
  const surfaceClass =
    surface === "raised"
      ? "border-gray-200 bg-white shadow-lg shadow-blue-950/10"
      : "border-gray-200 bg-gray-50";
  return (
    <div className={`rounded-none border p-4 ${surfaceClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      {caption && <p className="mt-1 text-[11px] text-gray-500">{caption}</p>}
      {note && <p className={`mt-1 text-xs font-medium ${noteClass}`}>{note}</p>}
    </div>
  );
}
