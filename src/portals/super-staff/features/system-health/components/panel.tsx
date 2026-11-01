import { CircleCheck, CircleMinus, CircleX, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/portals/super-staff/lib/utils";
import type { HealthStatus } from "../types";

/** `muted` is for a row with no grade of its own, e.g. a switched-off job. */
export type Tone = HealthStatus | "muted";

/**
 * Every colour the page gives a status, in one place: `solid` for pills and
 * the banner, `text` for a row's name, `fill` for dots, bars and the status
 * strip, `border` for a section tile, `icon` for a row's leading icon.
 */
export const TONE_STYLE: Record<
  Tone,
  { solid: string; text: string; fill: string; border: string; icon: LucideIcon; iconColor: string }
> = {
  ok: {
    solid: "bg-green-700 text-white",
    text: "text-green-800",
    fill: "bg-green-600",
    border: "border-gray-200",
    icon: CircleCheck,
    iconColor: "text-green-700",
  },
  warning: {
    solid: "bg-amber-500 text-white",
    text: "text-amber-700",
    fill: "bg-amber-500",
    border: "border-amber-300",
    icon: TriangleAlert,
    iconColor: "text-amber-500",
  },
  critical: {
    solid: "bg-red-700 text-white",
    text: "text-red-700",
    fill: "bg-red-600",
    border: "border-red-300",
    icon: CircleX,
    iconColor: "text-red-700",
  },
  muted: {
    solid: "bg-gray-200 text-gray-700",
    text: "text-gray-500",
    fill: "bg-gray-300",
    border: "border-gray-200",
    icon: CircleMinus,
    iconColor: "text-gray-400",
  },
};

export const STATUS_WORD: Record<HealthStatus, string> = {
  ok: "OK",
  warning: "Warning",
  critical: "Critical",
};

export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-semibold",
        TONE_STYLE[tone].solid,
      )}
    >
      {children}
    </span>
  );
}

export function StatusIcon({ tone }: { tone: Tone }) {
  const { icon: Icon, iconColor } = TONE_STYLE[tone];
  return <Icon className={cn("mt-0.5 h-6 w-6 shrink-0", iconColor)} aria-hidden="true" />;
}

/** One "Label: value" pair on a panel's summary line, the value tinted by tone. */
export function SummaryItem({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span>
      {label}:{" "}
      <strong
        className={cn(
          "font-semibold tabular-nums",
          tone === "muted" ? "text-gray-900" : TONE_STYLE[tone].text,
        )}
      >
        {value}
      </strong>
    </span>
  );
}

/**
 * A titled panel. `summary` is the line of counts under the title; `status`,
 * when given, is the section's grade from the database.
 */
export function Panel({
  id,
  title,
  status,
  summary,
  children,
}: {
  id?: string;
  title: string;
  status?: HealthStatus;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="scroll-mt-6 rounded-lg border border-gray-200 bg-white shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {status && <StatusPill tone={status}>{STATUS_WORD[status]}</StatusPill>}
      </header>
      {summary && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-gray-200 px-5 pb-3 pt-2 text-sm text-gray-600">
          {summary}
        </div>
      )}
      <div className={cn(!summary && "pt-3")}>{children}</div>
    </section>
  );
}

export function UsageBar({ pct, status }: { pct: number; status: Tone }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={cn("h-full rounded-full", TONE_STYLE[status].fill)}
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
    </div>
  );
}
