// Badge no longer derives its color from the status text it displays — that
// coupled presentation to a label rename (see src/portals/admin/lib/status-colors.ts). Callers
// now compute a `variant` from the raw enum CODE via the matching
// per-domain function in src/portals/admin/lib/status-colors.ts, and pass the (unrelated)
// display label separately as `status`. This mirrors the sibling Staff
// portal's own Badge API (src/portals/admin/components/ui/badge.tsx) — a `variant` prop
// over the same five-value vocabulary, not a caller-supplied className —
// which Phase 7 of the Admin Portal Fix Plan was going to converge this
// component onto anyway; doing it now avoids reworking this same component
// twice. Admin's own visual base classes (rounded-none, etc.) are unchanged
// from before this rework — only Staff's `variant` prop *pattern* is
// adopted, not Staff's `rounded-full` visual styling.
import { cn } from "@/portals/admin/lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  destructive: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export function Badge({ status, variant = "default" }: { status: string; variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-none px-2.5 py-0.5 text-xs font-medium", VARIANT_CLASSES[variant])}
    >
      {status}
    </span>
  );
}
