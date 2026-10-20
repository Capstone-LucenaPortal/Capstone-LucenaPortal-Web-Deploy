import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatManilaDate, formatManilaDateTime, type DateInput } from "@/shared/dates/manila";

// Merge Tailwind class names, resolving conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Every Super-staff date and time is Manila's, in the medium style
// ("Aug 1, 2026"). Same zone as the editor's +08:00 in ./datetime.ts.
export function formatDate(value: DateInput | null | undefined) {
  return formatManilaDate(value, "medium");
}

export function formatDateTime(value: DateInput | null | undefined) {
  return formatManilaDateTime(value, "medium");
}

// Render an SLA duration in hours as a compact "Xd Yh" string.
export function formatSLA(hours: number) {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return remainder ? `${days}d ${remainder}h` : `${days}d`;
}
