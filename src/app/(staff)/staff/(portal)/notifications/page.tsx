import { NotificationList } from "@/portals/staff/features/notifications/components/notification-list";
import { getNotifications } from "@/portals/staff/features/notifications/lib/queries";

export const metadata = { title: "Notifications · LucenaPortal Staff" };

/**
 * Not module-gated: my_notifications is the caller's own, whatever modules
 * they hold. Today every row is a Yellow Card Deadline Notice (l81), which
 * only Yellow Card staff receive, so a staff member without the module sees
 * the empty state.
 */
export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-lucena-blue">Notifications</h1>
      <p className="mt-2 text-gray-500">
        Notices addressed to you, newest first.
      </p>

      <div className="mt-6">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center">
            <p className="text-sm font-medium text-gray-900">No notifications</p>
            <p className="mt-1 text-sm text-gray-500">
              You are told here when a Yellow Card application turns At Risk or
              Overdue.
            </p>
          </div>
        ) : (
          <NotificationList items={notifications} />
        )}
      </div>
    </div>
  );
}
