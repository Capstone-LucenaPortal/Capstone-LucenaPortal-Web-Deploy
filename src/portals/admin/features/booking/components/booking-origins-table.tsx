// src/portals/admin/features/booking/components/booking-origins-table.tsx
"use client";

import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";

/**
 * This panel can never show data. `submit_booking` does not accept
 * `origin_barangay_code` or `origin_locality` as parameters and never writes
 * them, so `origin_barangay_code` is always null — and `is_resident`, a
 * generated column defined as `origin_barangay_code is not null`, therefore
 * always evaluates to `false` (not null: SQL's `IS NOT NULL` operator never
 * itself returns null) on every row `admin_booking_analytics` returns. That
 * is a deferred product decision (see Layer 29's own header), not a bug this
 * component can fix by deriving origin from something else.
 *
 * `bookings` is accepted (rather than dropped) so this component keeps
 * reading real data and can start rendering a real breakdown the moment
 * `origin_barangay_code` / `origin_locality` are actually captured, instead
 * of silently going stale. Until then it must say why it is empty rather
 * than rendering a blank table that reads as "no bookings exist" — that is
 * true even when `bookings` is non-empty, which is exactly what this
 * component pins.
 */
export function BookingOriginsTable({ bookings }: { bookings: BookingRow[] }) {
  const count = bookings.length;

  return (
    <section className="rounded-none border border-gray-200 bg-white">
      <div className="px-6 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">Bookings by origin</h2>
        <p className="text-sm text-gray-500">Where the bookers come from</p>
      </div>

      <div className="m-6 flex items-start gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-hidden
        >
          <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 004 21h16a2 2 0 001.89-2.96L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p>
          Booking origin is not yet collected. <code>submit_booking</code> does
          not capture <code>origin_barangay_code</code> or{" "}
          <code>origin_locality</code>, so this breakdown cannot be shown yet.
          {count > 0
            ? ` This range has ${count} booking${count === 1 ? "" : "s"}, none with origin data.`
            : null}
        </p>
      </div>
    </section>
  );
}
