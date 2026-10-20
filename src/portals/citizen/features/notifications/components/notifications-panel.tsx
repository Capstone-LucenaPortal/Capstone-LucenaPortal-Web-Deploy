'use client';

import { useEffect, useState } from 'react';
import type { MyNotification } from '@/portals/citizen/features/notifications/types';
import { notificationService, notificationTarget, unreadCount } from '@/portals/citizen/features/notifications/lib/notifications';
import { formatManilaDateTime } from '@/shared/dates/manila';

interface Props {
  /** Called with the dashboard section a notification points at, so opening
   * "Your booking has been quoted" lands on the booking tab. */
  onNavigate?: (section: 'incidents' | 'yellowCards' | 'bookings') => void;
}

/**
 * The citizen's inbox — the in-app channel.
 *
 * `my_notifications` and `mark_notification_read` both existed and worked, and
 * the portal had zero references to either. Every booking-lifecycle event
 * (quote issued, document rejected, payment verified/rejected, balance settled,
 * hold expiring), the incident sweeper's nudge and auto-close events, and every
 * Yellow Card decision write a row here — all of them once invisible to the
 * person who needed to act.
 *
 * Since DB layer `l64` this is no longer the only channel: an email row is
 * written beside each in-app one, and is sent on projects where the worker is
 * configured. `MyNotification` in `@/features/notifications/types` carries the
 * detail, including which copy may name email (the Privacy Notice) and which may
 * not (the service screens). Read it before writing any copy about how a citizen
 * hears back. SMS remains unimplemented.
 */
export default function NotificationsPanel({ onNavigate }: Props) {
  const [notifications, setNotifications] = useState<MyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    notificationService
      .getMine()
      .then((rows) => {
        if (cancelled) return;
        setNotifications(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load your notifications.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = async (n: MyNotification) => {
    // Optimistic: the read state is not worth a spinner, and markRead treats
    // the one error that means "this was never yours" (P0002) as a no-op.
    if (!n.read_at) {
      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: readAt } : x)));
      notificationService.markRead(n.id).catch(() => {
        // Leave the optimistic state in place. Re-marking it unread would make
        // the badge flicker for something the citizen has demonstrably seen.
      });
    }
    const target = notificationTarget(n);
    if (target && onNavigate) onNavigate(target.section);
  };

  const unread = unreadCount(notifications);

  return (
    <section
      aria-labelledby="notifications-heading"
      style={{
        background: 'white',
        border: '1px solid #DDDDDD',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        padding: '20px 24px',
        marginBottom: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h2 id="notifications-heading" style={{ fontSize: 18, fontWeight: 700, color: '#003DA5' }}>
          Notifications
        </h2>
        {unread > 0 && (
          <span
            style={{
              background: '#DC2626',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 999,
              padding: '2px 9px',
            }}
          >
            {unread} unread
          </span>
        )}
      </div>

      {loading && <p style={{ fontSize: 14, color: '#666666' }} role="status">Loading…</p>}

      {error && (
        <p role="alert" style={{ fontSize: 13, color: '#B91C1C' }}>
          {error}
        </p>
      )}

      {!loading && !error && notifications.length === 0 && (
        <p style={{ fontSize: 14, color: '#666666' }}>
          You have no notifications yet. Updates about your reports, applications and bookings will
          appear here.
        </p>
      )}

      {notifications.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {notifications.map((n) => {
            const isUnread = n.read_at === null;
            const target = notificationTarget(n);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void open(n)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isUnread ? '#F0F6FF' : 'white',
                    border: '1px solid #E5E7EB',
                    borderLeft: `3px solid ${isUnread ? '#003DA5' : '#E5E7EB'}`,
                    borderRadius: 6,
                    padding: '12px 14px',
                    cursor: target ? 'pointer' : 'default',
                    font: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: isUnread ? 700 : 600, color: '#111827' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 12, color: '#666666', whiteSpace: 'nowrap' }}>
                      {formatManilaDateTime(n.created_at, 'medium')}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {n.body}
                    </p>
                  )}
                  {isUnread && <span className="sr-only">Unread</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
