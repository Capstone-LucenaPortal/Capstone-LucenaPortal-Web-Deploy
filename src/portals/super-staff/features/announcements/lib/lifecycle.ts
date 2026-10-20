import type { Announcement, AnnouncementStatus } from "../types";

export type StatusCounts = Record<AnnouncementStatus, number> & { all: number };

const STATUSES: AnnouncementStatus[] = [
  "Draft",
  "Scheduled",
  "Published",
  "Expired",
];

/** Per-status counts for the list filter tabs, plus the total. */
export function computeStatusCounts(
  announcements: Announcement[],
): StatusCounts {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    AnnouncementStatus,
    number
  >;
  for (const a of announcements) {
    if (a.status in counts) counts[a.status] += 1;
  }
  return { ...counts, all: announcements.length };
}

/** What publishing will produce, for confirm-modal copy only — never sent to
 *  the database. Mirrors `post_status()` for the already-published branches. */
export function previewPublishedStatus(
  startAt: string | null,
  endAt: string | null,
  now: Date,
): AnnouncementStatus {
  if (startAt && new Date(startAt).getTime() > now.getTime()) return "Scheduled";
  if (endAt && new Date(endAt).getTime() < now.getTime()) return "Expired";
  return "Published";
}
