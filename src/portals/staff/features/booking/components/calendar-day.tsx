import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/portals/staff/lib/utils";
import { STATUS_BADGE_VARIANT, STATUS_LABELS } from "../lib/status";
import { SPACE_LABELS, SPACE_ORDER, type SpaceCode } from "../lib/venue-spaces";
import { heldUntilHour, type CalendarBlock, type DayCell, type DayStatus } from "../lib/calendar";
import type { MaintenancePeriod } from "../types";

/** The marker colours for a lane's status. Not the status-badge palette. */
const DAY_STATUS_DOT: Record<DayStatus, string> = {
  available: "bg-green-400",
  partial: "bg-yellow-400",
  "fully-booked": "bg-red-400",
  // Its own colour: a closed day must never read as a full one (SCRUM-263).
  "under-maintenance": "bg-purple-500",
};

const DAY_STATUS_TEXT: Record<DayStatus, string> = {
  available: "free",
  partial: "part-booked",
  "fully-booked": "fully booked",
  "under-maintenance": "under maintenance",
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
              maintenancePeriods={day.maintenancePeriodsBySpace[space]}
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
  maintenancePeriods,
  blocks,
  interactive,
}: {
  space: SpaceCode;
  status: DayStatus;
  maintenancePeriods: MaintenancePeriod[];
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
      {maintenancePeriods.map((period) => (
        <MaintenanceMarker key={period.id} period={period} dimmed={!interactive} />
      ))}
      {blocks.map((block) => (
        <Fragment key={`${block.bookingId}-${space}`}>
          <BlockChip block={block} interactive={interactive} />
          {block.changeoverHours > 0 && (
            <ChangeoverChip block={block} interactive={interactive} />
          )}
        </Fragment>
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
  const hours = hourRange(block.startHour, block.endHour);

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

/**
 * A Maintenance Period on this lane's Space (SCRUM-263, ADR 0012): the Space
 * and the reason, so the desk can tell a Citizen why the day is closed.
 *
 * Read-only, with no link and no button: setting, changing or retiring a
 * period is Super Staff's job. Purple, and solid rather than hatched, so it
 * reads as neither a Booking, a Changeover nor a fully booked lane.
 *
 * Labelled with the lane's own SPACE_LABELS, not the view's space_label: the
 * database calls the Arena "Arena", and "Arena" inside the "Sports Arena" lane
 * would look like a third room. A reason may run to 500 characters, so the
 * marker stops at three lines and the title carries the whole of it.
 */
function MaintenanceMarker({
  period,
  dimmed,
}: {
  period: MaintenancePeriod;
  dimmed: boolean;
}) {
  return (
    <span
      data-maintenance=""
      title={`${SPACE_LABELS[period.space]} is closed for maintenance from ${period.firstDay} to ${period.lastDay}: ${period.reason}`}
      className={cn(
        "mt-0.5 line-clamp-3 break-words rounded border border-purple-300 bg-purple-50 px-1 py-0.5 text-[11px] leading-tight text-purple-900",
        dimmed && "opacity-50",
      )}
    >
      {SPACE_LABELS[period.space]} · <span className="font-medium">Under maintenance</span> ·{" "}
      {period.reason}
    </span>
  );
}

/**
 * The reset time after an Event (SCRUM-261): its Space is held, but nothing is
 * happening in it. Hatched and dashed so it never reads as a second Event, and
 * not a link — it is the Booking's, and the Event chip above already opens it.
 *
 * Its length is the Booking's own recorded Changeover, never today's setting,
 * so an older Booking shows the Changeover it was actually given (ADR 0010).
 */
function ChangeoverChip({
  block,
  interactive,
}: {
  block: CalendarBlock;
  interactive: boolean;
}) {
  return (
    <span
      data-changeover=""
      title={`Kept free after ${block.reference} so the LCC can reset the space`}
      className={cn(
        "mt-0.5 block rounded border border-dashed border-gray-300 px-1 py-0.5 text-[10px] leading-tight text-gray-500",
        "bg-[repeating-linear-gradient(135deg,#f3f4f6_0_4px,#ffffff_4px_8px)]",
        !interactive && "opacity-50",
      )}
    >
      <span className="font-medium">Changeover</span>{" "}
      {hourRange(block.endHour, heldUntilHour(block))}
    </span>
  );
}

/**
 * "13:00–17:00". Wraps at midnight: an Event may end at closing and its
 * Changeover run on past it, so 22 + 3 reads "01:00", not "25:00".
 */
function hourRange(startHour: number, endHour: number): string {
  const clock = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;
  return `${clock(startHour)}–${clock(endHour)}`;
}
