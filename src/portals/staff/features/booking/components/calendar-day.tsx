import Link from "next/link";
import { cn } from "@/portals/staff/lib/utils";
import { STATUS_BADGE_VARIANT, STATUS_LABELS } from "../lib/status";
import { SPACE_LABELS, SPACE_ORDER, type SpaceCode } from "../lib/venue-spaces";
import type { CalendarBlock, DayCell, DayStatus } from "../lib/calendar";

/** The marker colours for a lane's status. Not the status-badge palette. */
const DAY_STATUS_DOT: Record<DayStatus, string> = {
  available: "bg-green-400",
  partial: "bg-yellow-400",
  "fully-booked": "bg-red-400",
};

const DAY_STATUS_TEXT: Record<DayStatus, string> = {
  available: "free",
  partial: "part-booked",
  "fully-booked": "fully booked",
};

/** Reuses the queue's status palette rather than inventing a second one. */
const BLOCK_TINT: Record<string, string> = {
  default: "border-gray-300 bg-gray-50 text-gray-700",
  success: "border-green-300 bg-green-50 text-green-800",
  warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
  destructive: "border-red-300 bg-red-50 text-red-800",
};

/**
 * One day, with a lane per physical space.
 *
 * Days outside the month render dimmed and their blocks are not interactive —
 * they are context for the weeks that straddle the edges, not this month's
 * work.
 */
export function CalendarDay({ day }: { day: DayCell }) {
  const dayNumber = Number(day.date.slice(8, 10));

  return (
    <td
      className={cn(
        "h-32 min-w-[9rem] border border-gray-200 align-top",
        !day.inMonth && "bg-gray-50",
        day.isToday && "ring-2 ring-inset ring-lucena-blue",
      )}
    >
      <div className="flex h-full flex-col p-1.5">
        <div className="flex items-baseline justify-between">
          <span
            className={cn(
              "text-sm font-medium",
              day.inMonth ? "text-gray-900" : "text-gray-500",
              day.isToday && "text-lucena-blue",
            )}
          >
            {dayNumber}
          </span>
          {day.isToday && (
            <span className="text-[10px] font-medium uppercase text-lucena-blue">
              Today
            </span>
          )}
        </div>

        <div className="mt-1 flex-1 space-y-1.5 overflow-hidden">
          {SPACE_ORDER.map((space) => (
            <Lane
              key={space}
              space={space}
              status={day.statusBySpace[space]}
              blocks={day.blocks.filter((b) => b.space === space)}
              interactive={day.inMonth}
            />
          ))}
        </div>
      </div>
    </td>
  );
}

function Lane({
  space,
  status,
  blocks,
  interactive,
}: {
  space: SpaceCode;
  status: DayStatus;
  blocks: CalendarBlock[];
  interactive: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", DAY_STATUS_DOT[status])}
          aria-hidden="true"
        />
        <span className="sr-only">
          {SPACE_LABELS[space]}: {DAY_STATUS_TEXT[status]}.
        </span>
        <span aria-hidden="true">{SPACE_LABELS[space]}</span>
      </p>
      {blocks.map((block) => (
        <BlockChip key={`${block.bookingId}-${space}`} block={block} interactive={interactive} />
      ))}
    </div>
  );
}

function BlockChip({
  block,
  interactive,
}: {
  block: CalendarBlock;
  interactive: boolean;
}) {
  const tint = BLOCK_TINT[STATUS_BADGE_VARIANT[block.status]] ?? BLOCK_TINT.default;
  const hours = `${String(block.startHour).padStart(2, "0")}:00–${String(
    block.endHour,
  ).padStart(2, "0")}:00`;

  const body = (
    <>
      <span className="block truncate font-medium">{block.reference}</span>
      <span className="block truncate">{block.title}</span>
      <span className="block text-[10px] opacity-80">
        {hours}
        {/* A Full Facility booking appears in BOTH lanes. Two
            identical-looking entries with no explanation read as a duplicate,
            which is exactly the confusion venue-grouping would have caused and
            which this design exists to remove. */}
        {block.spansBothSpaces && " · both spaces"}
      </span>
    </>
  );

  const className = cn(
    "mt-0.5 block rounded border px-1 py-0.5 text-[11px] leading-tight",
    tint,
    !interactive && "opacity-50",
  );

  if (!interactive) {
    return <span className={className}>{body}</span>;
  }

  return (
    <Link
      href={`/staff/booking/${block.bookingId}`}
      title={`${block.reference} · ${block.title} · ${block.venueLabel} · ${
        STATUS_LABELS[block.status]
      }`}
      className={cn(className, "hover:brightness-95")}
    >
      {body}
    </Link>
  );
}
