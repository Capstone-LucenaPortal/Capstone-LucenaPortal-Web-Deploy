import { formatInManila } from "@/shared/dates/manila";

/** The DB already cuts statement text to 120 characters; this holds the page to it. */
const STATEMENT_MAX_CHARS = 120;

export function truncateStatement(query: string): string {
  return query.length > STATEMENT_MAX_CHARS ? `${query.slice(0, STATEMENT_MAX_CHARS - 1)}…` : query;
}

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** An age or interval in seconds, as "45 s", "15 min", "1.5 h", "2 d". */
export function formatSeconds(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${Math.round(s / 86400)} d`;
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

/** "2:05:09 PM" in Manila, for "Updated {time} (Asia/Manila)". */
export function formatManilaClock(value: Date | string): string {
  return formatInManila(value, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

/** "14:05" in Manila, for a chart's time axis. */
export function formatManilaHourMinute(iso: string): string {
  return formatInManila(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
