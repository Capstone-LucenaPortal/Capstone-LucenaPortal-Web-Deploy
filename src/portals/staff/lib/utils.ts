import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MANILA_TIME_ZONE } from "@/shared/dates/manila";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Every Staff date and time is Manila's, the rule the DB follows since l65.
// Most of the portal renders on the server, and a hosted server runs in UTC,
// so the zone is set explicitly rather than left to the host. Same precedent
// as src/portals/admin/lib/dates.ts.
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Bytes as something a person reads, e.g. "200 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
