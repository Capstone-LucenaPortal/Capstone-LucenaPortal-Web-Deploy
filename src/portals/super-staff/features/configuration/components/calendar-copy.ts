import type { HolidayKind } from "../lib/calendar-types";

/**
 * Every calendar write ends by recomputing Yellow Card deadlines (l70b step
 * 6, never skipped). The operator has to know that before they save: the
 * edits here are not reference data, they move live promises to citizens.
 */
export const DEADLINE_NOTE =
  "Saving any change here moves the Processing Deadline of every open Yellow Card application whose clock is running. Paused and decided applications do not move.";

export const HOLIDAY_KINDS: { value: HolidayKind; label: string }[] = [
  { value: "regular", label: "Regular holiday" },
  { value: "special_non_working", label: "Special non-working day" },
  { value: "local", label: "Local holiday" },
  { value: "suspension", label: "Suspension of work" },
];
