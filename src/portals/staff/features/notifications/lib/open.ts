/**
 * Opening a notice: mark it read, then say where to go.
 *
 * Takes the client rather than building it, and lives outside ./actions.ts,
 * for the reason yellow-card/lib/review.ts gives: that module is "use server",
 * so a client parameter there would be a network-reachable argument.
 */

import type { Db } from "@/shared/supabase/server";
import { destinationOf, NOTIFICATIONS_PATH } from "./notice";

/**
 * Marks the notice read and returns the path to send the reader to.
 *
 * The destination comes from the row mark_notification_read RETURNS, not from
 * anything the browser posted: the RPC only touches a notice addressed to the
 * caller (l29), so the redirect can only ever point at the caller's own
 * notice's application. A form field naming the destination would be an open
 * redirect with extra steps.
 *
 * A failure lands back on the list rather than throwing. The notice simply
 * stays unread, and the reader can still reach the application from the
 * queue; an error page would cost them both.
 */
export async function openNotification(db: Db, notificationId: string): Promise<string> {
  const { data, error } = await db.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  return error || !data ? NOTIFICATIONS_PATH : destinationOf(data);
}
