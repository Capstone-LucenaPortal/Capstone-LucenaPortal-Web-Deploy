import { BellOff } from "lucide-react";
import { EmptyState } from "@/portals/responder/components/ui/empty-state";
import { NotificationList } from "@/portals/responder/features/incidents/components/notification-list";
import { getInbox } from "@/portals/responder/features/incidents/lib/inbox";

export const metadata = { title: "Notifications · LucenaPortal Responder" };

/**
 * A real route rather than a sheet (PRD §7).
 *
 * Rows arrive from `trg_notify_department_pool`, which writes one per active
 * responder in the department on every one of the four paths a report can enter
 * the pool — INCLUDING responders with `on_duty = false`. Duty is a headcount;
 * it never decides who gets the record.
 *
 * A pool arrival whose report has since been rerouted away, rejected or closed
 * is labelled "No longer in your pool" rather than removed (#138).
 */
export default async function NotificationsPage() {
  const notifications = await getInbox();
  // Read once, so every row is dated against the same instant (#139).
  const now = new Date();

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
        <NotificationList items={notifications} now={now} />
      )}
    </div>
  );
}
