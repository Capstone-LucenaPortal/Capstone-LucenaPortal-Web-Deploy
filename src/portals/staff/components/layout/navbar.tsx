import type { StaffUser } from "@/portals/staff/features/auth/types";
import { NotificationBell } from "@/portals/staff/features/notifications/components/notification-bell";
import { LogoutButton } from "./logout-button";

interface NavbarProps {
  user: StaffUser;
  /** Unread Notifications, read by the (portal) layout; null when unreadable. */
  unreadNotifications: number | null;
}

export function Navbar({ user, unreadNotifications }: NavbarProps) {
  return (
    <header className="h-16 border-b-[3px] border-lucena-blue bg-white px-6 flex items-center justify-between shrink-0">
      <span className="text-sm font-medium text-gray-500">
        Staff Portal
      </span>
      <div className="flex items-center gap-3">
        <NotificationBell unreadCount={unreadNotifications} />
        <span className="text-sm font-medium text-gray-900">
          {user.full_name}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
