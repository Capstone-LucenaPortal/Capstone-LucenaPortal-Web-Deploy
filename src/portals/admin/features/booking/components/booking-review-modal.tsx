// src/portals/admin/features/booking/components/booking-review-modal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/portals/admin/components/ui/modal";
import { Button } from "@/portals/admin/components/ui/button";
import { readBookingPii, BookingPii } from "@/portals/admin/features/booking/lib/bookings";
import { bookingStatusLabel } from "@/portals/admin/lib/status-labels";
import type { PortalError } from "@/portals/admin/lib/supabase/errors";

interface BookingReviewModalProps {
  bookingId: string | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-blue-900">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

export function BookingReviewModal({ bookingId, onClose }: BookingReviewModalProps) {
  const [data, setData] = useState<BookingPii | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<PortalError | null>(null);

  // readBookingPii writes a pii_access audit row on EVERY call, so this
  // effect must start at most one real call per open — but it must also not
  // hang forever if it happens to run twice for the same open (React Strict
  // Mode double-invokes a brand-new effect in dev: mount, cleanup, mount
  // again, synchronously, before any promise settles).
  //
  // Two designs were tried and rejected before this one (see
  // src/portals/admin/features/yellow-card/components/application-review-modal.tsx, which this guard is
  // copied from verbatim):
  // - Marking an id "fetched" the instant the fetch starts: the second
  //   invocation sees it as covered and skips its own fetch, but the first
  //   invocation's cleanup already set its `active` flag to false, so its
  //   result is discarded by both invocations — nothing ever resolves.
  // - Erasing that mark on an unsettled teardown so the second invocation is
  //   free to retry: this resolves, but the second invocation starts a
  //   genuinely new network call — two real calls (two audit rows) for one
  //   open.
  //
  // The actual fix is to deduplicate the in-flight *promise*, not the effect
  // run: this ref holds the one request currently in flight for a given id.
  // An invocation that finds a live request for the same id attaches to it
  // instead of starting a new one; each invocation still guards its own
  // state updates with its own `active` flag, so whichever invocation is
  // still mounted when the shared promise settles is the one that wins. The
  // ref is cleared once that request settles, so a later, genuinely new open
  // of the same id — after this one closes — starts its own fresh, separately
  // audited call.
  const inFlight = useRef<{ id: string; promise: Promise<BookingPii> } | null>(null);

  useEffect(() => {
    if (!bookingId) {
      inFlight.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to the closed-modal state when bookingId clears is the fetch-in-effect teardown, not a derivable render value; the promise-dedup guarantee above depends on this effect shape and must not change.
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;

    const attempt =
      inFlight.current?.id === bookingId
        ? inFlight.current
        : { id: bookingId, promise: readBookingPii(bookingId) };
    inFlight.current = attempt;

    setIsLoading(true);
    setError(null);
    setData(null);

    attempt.promise
      .then((row) => {
        if (!active) return;
        setData(row);
      })
      .catch((err: PortalError) => {
        if (!active) return;
        setError(err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
        if (inFlight.current === attempt) inFlight.current = null;
      });

    return () => {
      active = false;
    };
  }, [bookingId]);

  const isOpen = bookingId !== null;

  return (
    <Modal
      title="Booking Review"
      isOpen={isOpen}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-6">
        <p className="rounded-none border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Viewing this organiser&apos;s personal details is recorded in the audit log.
        </p>

        {isLoading && (
          <p className="py-8 text-center text-sm text-gray-500">Loading booking details…</p>
        )}

        {!isLoading && error && (
          <p className="py-8 text-center text-sm text-red-700">
            {error.kind === "permission"
              ? "You do not have permission to view this booking's details."
              : error.kind === "not-found"
                ? "This booking could not be found."
                : `Unable to load booking details: ${error.message}`}
          </p>
        )}

        {!isLoading && !error && data && (
          <>
            <div>
              <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">
                Booking Information
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Reference" value={data.reference} />
                <Field label="Event Title" value={data.event_title} />
                <Field label="Venue" value={data.venue_label} />
                <Field label="Event Date" value={data.event_date} />
                <Field label="Start Time" value={data.start_time} />
                <Field label="Duration" value={`${data.duration_hours} hours`} />
                {/* Read via the shared bookingStatusLabel lookup, not the
                    raw status code, so this modal describes the same row
                    the table's own "Status" column describes with the same
                    friendly word (e.g. "Awaiting quote", not
                    "awaiting_quote") — the table row's Review button opens
                    THIS modal, so the two must agree (Admin Portal Fix
                    Plan, final review). BookingPii types this column as
                    plain `string`, not BookingStatusValue, hence the
                    fallback lookup in src/portals/admin/lib/status-labels.ts rather than a
                    direct Record index. */}
                <Field label="Status" value={bookingStatusLabel(data.status)} />
                <Field label="Estimated Headcount" value={`${data.estimated_headcount}`} />
              </div>
            </div>

            <div>
              <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">
                Organiser Information
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Contact Person" value={data.contact_person} />
                <Field label="Contact Number" value={data.contact_number} />
                <Field label="Email Address" value={data.email_address} />
                <Field label="Organization" value={data.organization_name} />
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
