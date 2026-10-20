/**
 * What a notice is ABOUT, in one place: the list asks it for the application
 * whose status to show, and opening a notice asks it where to go. A second
 * module that starts sending staff notices changes this file and nothing else.
 */

export const NOTIFICATIONS_PATH = "/staff/notifications";

interface NoticeTarget {
  module_code: string | null;
  record_id: string | null;
}

/** The Yellow Card application a notice is about, or null if it is about none. */
export function applicationIdOf(notice: NoticeTarget): string | null {
  return notice.module_code === "yellow_card" ? notice.record_id : null;
}

/** Where opening the notice leads: its application, else back to the list. */
export function destinationOf(notice: NoticeTarget): string {
  const applicationId = applicationIdOf(notice);
  return applicationId ? `/staff/yellow-card/${applicationId}` : NOTIFICATIONS_PATH;
}
