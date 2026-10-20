import { Check } from "lucide-react";
import { markNotificationRead } from "@/portals/responder/features/incidents/actions";
import { timeOfDay } from "@/portals/responder/features/incidents/lib/work";
import type { ResponderNotification } from "@/portals/responder/features/incidents/types";
import { cn } from "@/portals/responder/lib/utils";

/**
 * The inbox. `my_notifications` (l24) scopes on recipient_user_id rather than
 * citizen_id — its own header says it "is the inbox, not a citizen-only
 * surface" — and a responder's staff_accounts.id IS their auth.users.id, so no
 * responder-specific view was ever needed and l56 did not add one.
 *
 * Each mark-read is a form posting a server action, so nothing here becomes a
 * client component. Read rows keep no button: `mark_notification_read` is
 * idempotent, but an affordance that does nothing is worse than no affordance.
 */
export function NotificationList({
  items,
}: {
  items: ResponderNotification[];
}) {
  return (
    <ul className="overflow-hidden rounded-lg border border-gray-200">
      {items.map((item) => {
        const unread = item.read_at === null;

        return (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0",
              unread ? "bg-blue-50" : "bg-white",
            )}
          >
            {/* The dot is decorative; "Unread" is what a screen reader gets. */}
            <span
              aria-hidden
              className={cn(
                "mt-1.75 h-2 w-2 shrink-0 rounded-full",
                unread ? "bg-lucena-blue" : "bg-transparent",
              )}
            />

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[14px] text-pretty",
                  unread ? "font-semibold text-gray-900" : "text-gray-600",
                )}
              >
                {item.title}
              </p>
              {item.body && (
                <p className="mt-0.5 text-[12.5px] text-pretty text-gray-500">
                  {item.body}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
                {item.created_at && <span>{timeOfDay(item.created_at)}</span>}
                {unread && (
                  <span className="font-semibold text-lucena-blue">Unread</span>
                )}
              </p>
            </div>

            {unread && (
              <form action={markNotificationRead} className="shrink-0">
                <input type="hidden" name="notificationId" value={item.id ?? ""} />
                <button
                  type="submit"
                  aria-label={`Mark as read: ${item.title}`}
                  className="flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-[12px] font-semibold text-gray-900 hover:bg-gray-50"
                >
                  <Check size={13} aria-hidden />
                  Read
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
