import { ChevronRight } from "lucide-react";
import { openNotificationAction } from "@/portals/staff/features/notifications/lib/actions";
import { YellowCardStatusBadge } from "@/portals/staff/features/yellow-card/components/status-badge";
import { cn, formatDateTime } from "@/portals/staff/lib/utils";
import type { StaffNotification } from "../types";

/**
 * The Notifications list, modelled on the Responder's.
 *
 * Each row is a form posting a server action, so nothing here is a client
 * component. Opening a notice marks it read and takes the reader to its
 * application in one step; a read notice keeps the button, because it still
 * leads somewhere.
 *
 * The status badge is the application's status NOW. Deciding an application
 * neither marks nor hides its notices (spec Q11) — the badge is what tells the
 * reader a warning is moot.
 */
export function NotificationList({ items }: { items: StaffNotification[] }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {items.map((item) => {
        const unread = item.readAt === null;

        return (
          <li
            key={item.id}
            className={cn(
              "border-b border-gray-100 last:border-b-0",
              unread ? "bg-blue-50" : "bg-white",
            )}
          >
            <form action={openNotificationAction}>
              <input type="hidden" name="notificationId" value={item.id} />
              <button
                type="submit"
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-lucena-blue"
              >
                {/* The dot is decorative; "Unread" is what a screen reader gets. */}
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    unread ? "bg-lucena-blue" : "bg-transparent",
                  )}
                />

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm text-pretty",
                      unread ? "font-semibold text-gray-900" : "text-gray-700",
                    )}
                  >
                    {item.title}
                  </span>
                  {item.body && (
                    <span className="mt-0.5 block text-sm text-pretty text-gray-500">
                      {item.body}
                    </span>
                  )}
                  <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    {item.createdAt && <span>{formatDateTime(item.createdAt)}</span>}
                    {unread && (
                      <span className="font-semibold text-lucena-blue">Unread</span>
                    )}
                  </span>
                </span>

                {item.applicationStatus && (
                  <span className="shrink-0">
                    <YellowCardStatusBadge status={item.applicationStatus} />
                  </span>
                )}
                <ChevronRight
                  size={16}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-gray-400"
                />
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
