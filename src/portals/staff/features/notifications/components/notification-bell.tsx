import Link from "next/link";
import { Bell } from "lucide-react";
import { NOTIFICATIONS_PATH } from "../lib/notice";

/**
 * The navbar's way in to Notifications. The count is read by the (portal)
 * layout on every page load and handed down, so it is as fresh as the page;
 * opening a notice revalidates the layout, which is what makes it drop.
 *
 * No badge at zero: a "0" reads as something to look at. A count that could
 * not be read (null) shows "?", never zero, so a failed read cannot pass for
 * "nothing needs you".
 */
export function NotificationBell({ unreadCount }: { unreadCount: number | null }) {
  const label =
    unreadCount === null
      ? "Notifications, unread count unavailable"
      : unreadCount > 0
        ? `Notifications, ${unreadCount} unread`
        : "Notifications";

  const badge =
    unreadCount === null ? "?" : unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Link
      href={NOTIFICATIONS_PATH}
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
      <Bell size={20} aria-hidden />
      {badge && (
        <span
          aria-hidden
          className={
            "absolute -right-1 -top-1 min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 text-white " +
            (unreadCount === null ? "bg-gray-500" : "bg-red-600")
          }
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
