import { BellOff } from "lucide-react";
import { EmptyState } from "@/portals/responder/components/ui/empty-state";
import { NotificationList } from "@/portals/responder/features/incidents/components/notification-list";
import { getNotifications } from "@/portals/responder/features/incidents/lib/data";

export const metadata = { title: "Notifications · LucenaPortal Responder" };

/**
 * A real route rather than a sheet (PRD §7).
 *
 * Rows arrive from `trg_notify_department_pool`, which writes one per active
 * responder in the department on every one of the four paths a report can enter
 * the pool — INCLUDING responders with `on_duty = false`. Duty is a headcount;
 * it never decides who gets the record.
 */
export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="mx-auto max-w-2xl px-3 py-3.5">
      <h1 className="px-1 pb-3 text-lg font-bold text-gray-900">
        Notifications
      </h1>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications"
          // Promises nothing beyond the Inbox: a phone alert is opt-in per
          // device and on duty only (ISO-9, ADR 0001), and copy that promises a
          // channel the responder may not have is worse than no copy.
          description="New verified reports in your department land here."
          className="py-12"
        />
      ) : (
        <NotificationList items={notifications} />
      )}
    </div>
  );
}
