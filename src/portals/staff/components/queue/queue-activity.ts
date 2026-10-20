/**
 * The arithmetic behind a queue's arrival badge.
 *
 * Pure and separate from both the poll (a Server Action, one per feature
 * module) and the timer (the client component beside this file), so the one
 * piece with a rule in it can be tested without either.
 *
 * Shared across the three queues because it carries no module content but the
 * noun, which the caller supplies. See ADR-0002.
 */

/**
 * How much work has arrived since the page was rendered.
 *
 * Clamped at zero: the count can fall below the baseline when colleagues clear
 * the backlog faster than it fills. That is less work than at load, not
 * negative new work, and "-2 new" is nonsense on a screen.
 */
export function newArrivals(baseline: number, current: number): number {
  return Math.max(0, current - baseline);
}

/**
 * Badge text, or null when there is nothing to announce.
 *
 * The noun is the caller's, because what a queue calls its arrivals is module
 * content: Yellow Card and Incidents say "new", Booking says "more waiting" so
 * its badge is not mistaken for the backlog level sitting next to it.
 *
 * Pick one that reads the same for one as for many: nothing here pluralises,
 * so "1 new" and "4 new" are both correct and "1 applications" would not be.
 */
export function arrivalLabel(count: number, noun: string): string | null {
  return count > 0 ? `${count} ${noun}` : null;
}
