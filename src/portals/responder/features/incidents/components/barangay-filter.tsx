"use client";

import { useState } from "react";
import Link from "next/link";
import { Filter } from "lucide-react";
import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";
import {
  poolHref,
  type BarangayCount,
} from "@/portals/responder/features/incidents/lib/barangay-filter";
import { cn } from "@/portals/responder/lib/utils";

/**
 * The pool header's Barangay button and its sheet (issue #196).
 *
 * ⚠️ THE LINE BETWEEN URL AND CLIENT STATE IS DELIBERATE. The URL (`?brgy=`)
 * holds what the responder CHOSE — worth linking to, kept across Refresh. Only
 * whether the sheet is open is client state: in the URL, the back button would
 * walk through opening and closing it. So each row is a plain `<Link>` and the
 * page, a server component, does the filtering.
 *
 * Rows are plain links, like the pool cards beside them, not the held
 * navigation the exit sheets use (issue #7): picking a barangay offline fails
 * the way opening a card does, and loses nothing the responder typed.
 */
export function BarangayFilter({
  counts,
  total,
  selected,
  report,
}: {
  /** Every barangay in the whole pool, alphabetical — never the filtered view. */
  counts: BarangayCount[];
  /** The whole pool's size. */
  total: number;
  selected: string | null;
  /** The report open beside the list; choosing a barangay keeps it open. */
  report: string | null;
}) {
  const [open, setOpen] = useState(false);
  const active = selected !== null;
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Disabled only when there is nothing to filter AND nothing to undo: a
        // responder filtered into an empty pool still needs the way back.
        disabled={total === 0 && !active}
        aria-pressed={active}
        className={cn(
          "flex h-7.5 max-w-40 min-w-0 items-center gap-1.5 rounded-full border px-2.75 text-xs font-medium disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400",
          active
            ? "border-lucena-blue bg-blue-50 text-blue-800"
            : "border-gray-300 bg-white text-gray-900",
        )}
      >
        <Filter size={14} className="shrink-0" aria-hidden />
        <span className="truncate">{active ? `Brgy. ${selected}` : "Barangay"}</span>
      </button>

      <BottomSheet open={open} onClose={close} title="Filter by barangay">
        <ul className="mt-3 flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
          <Row
            href={poolHref({ report })}
            label="All barangays"
            count={total}
            current={!active}
            onPick={close}
          />
          {counts.map(({ name, count }) => (
            <Row
              key={name}
              href={poolHref({ report, brgy: name })}
              label={`Brgy. ${name}`}
              count={count}
              current={name === selected}
              onPick={close}
            />
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

function Row({
  href,
  label,
  count,
  current,
  onPick,
}: {
  href: string;
  label: string;
  count: number;
  current: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onPick}
        aria-current={current ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-3.25 text-left text-[14.5px]",
          current
            ? "bg-blue-50 font-semibold text-blue-800"
            : "font-normal text-gray-900 hover:bg-gray-50",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-xs text-gray-400 tabular-nums">{count}</span>
      </Link>
    </li>
  );
}
