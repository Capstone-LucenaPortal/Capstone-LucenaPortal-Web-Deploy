import {
  AlignLeft,
  Bell,
  ClipboardList,
  History,
  User,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeTone = "pool" | "alert";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which count in `NavCounts` fills this item's badge, if any. */
  badgeKey?: keyof NavCounts;
  badgeTone?: NavBadgeTone;
  /** Renders a pulsing dot instead of a number (design: an active claim). */
  pulseKey?: "hasActiveClaim";
}

export interface NavCounts {
  pool: number;
  notifications: number;
}

/**
 * One source of truth for both nav surfaces — the phone drawer and the
 * desktop rail render the same destinations from this list.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/responder/pool",
    label: "Pool",
    icon: AlignLeft,
    badgeKey: "pool",
    badgeTone: "pool",
  },
  {
    href: "/responder/my-ticket",
    label: "My ticket",
    icon: ClipboardList,
    pulseKey: "hasActiveClaim",
  },
  { href: "/responder/history", label: "History", icon: History },
  {
    href: "/responder/notifications",
    label: "Notifications",
    icon: Bell,
    badgeKey: "notifications",
    badgeTone: "alert",
  },
  { href: "/responder/profile", label: "Profile", icon: User },
];
