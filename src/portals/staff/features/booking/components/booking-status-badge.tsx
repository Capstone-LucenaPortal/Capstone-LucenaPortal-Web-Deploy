import { Badge } from "@/portals/staff/components/ui/badge";
import {
  CANCELLATION_REASON_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
} from "../lib/status";
import type { BookingCancellationReason, BookingStatus } from "../types";

/**
 * The status, and — when it is `cancelled` — why.
 *
 * A booking a citizen cancelled and one the sweep dropped for non-payment are
 * the same colour otherwise, and the difference is the entire question of
 * whether anyone did anything wrong. `bookings.cancellation_reason` is a real
 * enum with four values, and the sweep writes `expired_unpaid` to exactly four
 * rows in the sandbox today.
 */
export function BookingStatusBadge({
  status,
  cancellationReason = null,
}: {
  status: BookingStatus;
  cancellationReason?: BookingCancellationReason | null;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
      {status === "cancelled" && cancellationReason && (
        <Badge variant="default">
          {CANCELLATION_REASON_LABELS[cancellationReason]}
        </Badge>
      )}
    </span>
  );
}
