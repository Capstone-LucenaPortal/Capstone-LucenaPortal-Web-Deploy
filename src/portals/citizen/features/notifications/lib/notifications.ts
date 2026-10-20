import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import type { MyNotification } from '../types';

/** Citizen-facing copy for a notifications read failure. Never interpolate
 * `error.message` — it is raw PostgREST text naming views and columns. */
const NOTIFICATIONS_LOAD_ERROR =
  'Could not load your notifications right now. Please try again later.';

export const notificationService = {
  /**
   * Newest first. Returns `[]` in mock mode rather than fabricating rows —
   * a fake notification would point at a record that does not exist.
   */
  async getMine(): Promise<MyNotification[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('my_notifications')
      .select(
        'id, module_code, record_id, event_code, channel, status, title, body, created_at, sent_at, read_at',
      )
      .order('created_at', { ascending: false });
    if (error) throw new Error(NOTIFICATIONS_LOAD_ERROR);
    return (data as MyNotification[]) ?? [];
  },

  /**
   * Mark one notification read.
   *
   * `mark_notification_read` raises `P0002` when the notification is not
   * addressed to this user. Per the DB's convention that is a genuine 500 and
   * signals a client bug (a stale id, or an id from another session) — never a
   * transient fault. So it must NOT be retried; it resolves silently here and
   * the caller's optimistic UI simply stands. Any other error surfaces so a
   * real outage is not swallowed.
   */
  async markRead(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.rpc('mark_notification_read', {
      p_notification_id: id,
    });
    if (!error) return;
    if (error.code === 'P0002') return;
    throw new Error("Couldn't update that notification.");
  },
};

/** Pure: unread count from a notification list. Kept separate from the fetch so
 * the nav badge and the panel can share one definition of "unread". */
export function unreadCount(notifications: MyNotification[]): number {
  return notifications.filter((n) => n.read_at === null).length;
}

/**
 * Pure: which dashboard section a notification points at. Returns null when the
 * notification carries no `record_id`, or names a module the dashboard has no
 * section for — a deep link is an enhancement, never a requirement for display.
 */
export function notificationTarget(
  n: MyNotification,
): { section: 'incidents' | 'yellowCards' | 'bookings'; recordId: string } | null {
  if (!n.record_id) return null;
  switch (n.module_code) {
    // 'incidents', plural — that is the enum label, verified against the
    // sandbox. A singular 'incident' here silently produced no deep link.
    case 'incidents':
      return { section: 'incidents', recordId: n.record_id };
    case 'yellow_card':
      return { section: 'yellowCards', recordId: n.record_id };
    case 'booking':
      return { section: 'bookings', recordId: n.record_id };
    default:
      return null;
  }
}
