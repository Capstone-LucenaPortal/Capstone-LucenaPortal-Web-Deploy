// src/portals/admin/components/ui/kpi-tile.tsx
import { ReactNode } from "react";
import Link from "next/link";
import type { Delta } from "@/portals/admin/lib/aggregate";

// Which way is good news for the tile's figure. An effectiveness figure
// passes higher- or lower-is-better, and its delta then ends in "better" or
// "worse", in words and in a matching colour, so colour is never the only
// signal. A volume figure (a count of activity) is neutral: more requests is
// neither good nor bad news, so its delta stays grey with no word. See the
// Deltas section of src/portals/admin/docs/metrics.md.
export type KpiDirection = "higher-is-better" | "lower-is-better" | "neutral";

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
  // here rather than "Loading…" text (Admin Portal Fix Plan, Task 4.3). A
  // Delta is a "vs previous period" note, judged against `direction`.
  note?: ReactNode | Delta;
  noteTone: "positive" | "negative" | "neutral";
  direction?: KpiDirection;
  surface?: "solid" | "raised";
}

function isDelta(note: ReactNode | Delta): note is Delta {
  return typeof note === "object" && note !== null && "text" in note && "movement" in note;
}

// "better" or "worse" for a delta that moved on a figure with a direction;
// null for a volume figure, or a delta that shows no movement.
function verdictOf(delta: Delta, direction: KpiDirection): "better" | "worse" | null {
  if (direction === "neutral" || delta.movement === null) return null;
  const rose = delta.movement === "up";
  return rose === (direction === "higher-is-better") ? "better" : "worse";
}

function KpiNote({
  note,
  noteTone,
  direction,
}: {
  note: ReactNode | Delta;
  noteTone: KpiTileProps["noteTone"];
  direction: KpiDirection;
}) {
  const toneClass = noteTone === "neutral" ? "text-gray-500" : "text-gray-600";
  const delta = isDelta(note) ? note : null;
  const verdict = delta ? verdictOf(delta, direction) : null;
  const noteClass = verdict === "better" ? "text-green-700" : verdict === "worse" ? "text-red-700" : toneClass;
  const noteContent = delta ? (verdict ? `${delta.text} · ${verdict}` : delta.text) : (note as ReactNode);
  if (!noteContent) return null;
  return <p className={`mt-1 text-xs font-medium ${noteClass}`}>{noteContent}</p>;
}

function surfaceClassOf(surface: KpiTileProps["surface"]): string {
  return surface === "raised"
    ? "border-gray-200 bg-white shadow-lg shadow-blue-950/10"
    : "border-gray-200 bg-gray-50";
}

export function KpiTile({ label, value, caption, note, noteTone, direction = "neutral", surface = "raised" }: KpiTileProps) {
  return (
    <div className={`rounded-none border p-4 ${surfaceClassOf(surface)}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      {caption && <p className="mt-1 text-[11px] text-gray-500">{caption}</p>}
      <KpiNote note={note} noteTone={noteTone} direction={direction} />
    </div>
  );
}

// One service's line on a SplitKpiTile: its name, its value, and the same
// caption and note a KpiTile takes. `link` opens the requests behind the
// value, such as SLA Reports' Finished late (#127).
export interface KpiPart {
  name: string;
  value: ReactNode;
  caption?: ReactNode;
  note?: ReactNode | Delta;
  link?: { href: string; label: string };
}

// A KpiTile that shows its figure once per service instead of one pooled
// value, for figures whose services are judged against different clocks
// (ADR 0001), such as SLA compliance. Every part shares the tile's
// direction, so each part's delta reads "better" or "worse" the same way.
// `footnote` is one line under every part that holds for all of them, such
// as "Project target: 85%".
export function SplitKpiTile({
  label,
  parts,
  footnote,
  noteTone,
  direction = "neutral",
  surface = "raised",
}: Omit<KpiTileProps, "value" | "caption" | "note"> & { parts: KpiPart[]; footnote?: ReactNode }) {
  return (
    <div className={`rounded-none border p-4 ${surfaceClassOf(surface)}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      {parts.map((part) => (
        <div key={part.name} className="mt-2">
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-gray-600">{part.name}</span>
            <span className="text-xl font-bold tabular-nums text-gray-900">{part.value}</span>
          </p>
          {part.caption && <p className="text-[11px] text-gray-500">{part.caption}</p>}
          {part.link && (
            <Link href={part.link.href} className="text-[11px] font-medium text-blue-800 underline hover:text-blue-950">
              {part.link.label}
            </Link>
          )}
          <KpiNote note={part.note} noteTone={noteTone} direction={direction} />
        </div>
      ))}
      {footnote && <p className="mt-2 text-xs font-medium text-gray-500">{footnote}</p>}
    </div>
  );
}
