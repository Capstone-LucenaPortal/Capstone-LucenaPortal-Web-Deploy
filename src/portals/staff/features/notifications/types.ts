import type { YellowCardStatus } from "@/portals/staff/features/yellow-card/types";

/**
 * One of a staff member's Notifications — today, a Yellow Card Deadline Notice
 * written by l81's sweep. Read from `my_notifications`, which is the in_app
 * channel only (l64), so the email half of each notice never appears here.
 */
export interface StaffNotification {
  id: string;
  title: string;
  body: string | null;
  /** Nullable only because every view column is; the table's is NOT NULL. */
  createdAt: string | null;
  readAt: string | null;
  /**
   * How the application the notice is about stands NOW, read from the queue at
   * render time — not how it stood when the notice was written. That is what
   * makes a warning about a since-decided application visibly moot.
   *
   * NULL when the notice is not about a Yellow Card application, or when the
   * queue does not return it (a failed module gate is HTTP 200 and no rows).
   */
  applicationStatus: YellowCardStatus | null;
}
