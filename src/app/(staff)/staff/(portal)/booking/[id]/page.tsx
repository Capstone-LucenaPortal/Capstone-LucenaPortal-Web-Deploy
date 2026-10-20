import { notFound } from "next/navigation";
import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import { Card, CardHeader, CardTitle, CardContent } from "@/portals/staff/components/ui/card";
import { BackLink } from "@/portals/staff/components/ui/back-link";
import { getBookingDossier } from "@/portals/staff/features/booking/lib/booking-dossier";
import { getBookingConfig } from "@/portals/staff/features/booking/lib/config";
import { getOrganizer } from "@/portals/staff/features/booking/lib/get-organizer";
import { formatCurrency } from "@/portals/staff/features/booking/lib/money";
import {
  describeHold,
  describeWait,
  formatEventDay,
  getEndTime,
} from "@/portals/staff/features/booking/lib/schedule";
import { BookingStatusBadge } from "@/portals/staff/features/booking/components/booking-status-badge";
import { RateTierBadge } from "@/portals/staff/features/booking/components/rate-tier-badge";
import { PaymentsCard } from "@/portals/staff/features/booking/components/payments-card";
import { BookingTimeline } from "@/portals/staff/features/booking/components/booking-timeline";
import { QuoteForm } from "@/portals/staff/features/booking/components/quote-form";
import { ReviewDocumentAction } from "@/portals/staff/features/booking/components/review-document-action";
import { VerifyPaymentAction } from "@/portals/staff/features/booking/components/verify-payment-action";
import { RecordBalanceAction } from "@/portals/staff/features/booking/components/record-balance-action";
import { RejectBookingAction } from "@/portals/staff/features/booking/components/reject-booking-action";
import { CompleteBookingAction } from "@/portals/staff/features/booking/components/complete-booking-action";
import { getCurrentStaffUser } from "@/portals/staff/features/auth/lib/session";
import { deskMoves } from "@/portals/staff/features/booking/lib/desk-moves";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}

/** A timestamp as a readable Manila-local moment, or an em dash. */
function stamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: MANILA_TIME_ZONE,
  }).format(date);
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The only clock on this screen. Both date rules below are measured against
  // this one moment: a render-top that creates two has two answers to what time
  // it is and no reason to prefer either. See ADR-0005.
  const now = new Date();

  const dossier = await getBookingDossier(id);

  // Null covers both "no such booking" and "not visible to you" — the view
  // returns no rows for either, and the page must not distinguish them.
  if (!dossier) {
    notFound();
  }

  // Two reads beside the dossier, not folded into it. The session answers "who
  // is looking" rather than "what is being looked at" — it is read here and
  // handed to deskMoves below, which is where that question is half the
  // answer. The config is a fact
  // about the office's rules rather than about this booking, and the Queue and
  // the calendar read it too — folding it in would give it two owners.
  //
  // Both come after the guard, so an id that resolves to nothing still fires
  // nothing else. The user costs nothing — its profile read is cache()-wrapped
  // and the (portal) layout already has it in flight — but the config read is a
  // genuine serial round-trip to a one-row view, and it is accepted as
  // permanent rather than pending. The only thing that would buy it back is
  // firing it before the guard, which sells the two-phase guarantee for a
  // config lookup. See ADR-0006.
  const [config, user] = await Promise.all([
    getBookingConfig(),
    getCurrentStaffUser(),
  ]);

  const {
    booking,
    payments,
    documents,
    events,
    classificationLabel,
    rateTypeLabel,
    commercialReference: reference,
  } = dossier;

  const endTime = getEndTime(booking.start_time, booking.duration_hours);
  const hold = describeHold(booking.hold_expires_at, booking.status, now);
  // What the Hold is FOR decides its sentence: an upload before the Tier
  // Claim exists, a corrected upload after a Revision Request, or a payment.
  const holdFor =
    booking.status === "pending"
      ? "upload"
      : booking.status === "awaiting_resubmission"
        ? "resubmission"
        : "payment";

  // What the desk can do with this booking right now, as one record rather
  // than six gates assembled here. Every fact a control needs arrives beside
  // the gate that guarantees it — which is why the balance amount below is
  // read off the move rather than asserted non-null. See ADR-0007.
  const {
    quoting,
    reviewingDocument,
    verifyingPayment,
    recordingBalance,
    rejecting,
    completing,
    anyOpen,
  } = deskMoves({ booking, payments, documents, user, now });

  const residency = booking.is_resident
    ? `Lucena resident${
        booking.origin_barangay_code ? ` · ${booking.origin_barangay_code}` : ""
      }`
    : `Non-resident${booking.origin_locality ? ` · ${booking.origin_locality}` : ""}`;

  return (
    <div>
      <BackLink href="/staff/booking" label="Back to Booking" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">
            {booking.event_title}
          </h1>
          <p className="mt-1 text-gray-500">
            {booking.reference_number} · Submitted {stamp(booking.submitted_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge
            status={booking.status}
            cancellationReason={booking.cancellation_reason}
          />
          <RateTierBadge
            tier={booking.rate_tier}
            verified={booking.tier_verified}
          />
        </div>
      </div>

      {hold.kind === "running" && (
        <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {holdFor === "upload"
            ? "Document upload window closes in"
            : holdFor === "resubmission"
              ? "Resubmission window closes in"
              : "Payment window closes in"}{" "}
          {hold.hoursLeft} {hold.hoursLeft === 1 ? "hour" : "hours"} —{" "}
          {stamp(booking.hold_expires_at)}.
        </p>
      )}
      {hold.kind === "expired" && (
        /* Not a speculation. submit_downpayment and confirm_upload both raise
           42501 once the Hold has closed, so the organiser genuinely cannot
           act any more; sweep_expired_holds cancels the booking. */
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {holdFor === "payment"
            ? `The payment window closed on ${stamp(booking.hold_expires_at)}. The organiser can no longer pay for this booking.`
            : holdFor === "resubmission"
              ? `The resubmission window closed on ${stamp(booking.hold_expires_at)}. The organiser can no longer upload a corrected document.`
              : `The upload window closed on ${stamp(booking.hold_expires_at)}. The organiser can no longer upload the organisation document.`}
        </p>
      )}

      {/* Tier Review (SCRUM-198). Whose turn it is, how long it has waited,
          and which look this is — the look is the server's. */}
      {booking.status === "awaiting_tier_review" && (
        <p className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          This Tier Claim has been waiting on Tier Review for{" "}
          {describeWait(booking.tier_review_since, now) ?? "an unknown time"}.{" "}
          {booking.tier_review_look === 2
            ? "This is its second and last look, after a Revision Request — accept or reject it."
            : "This is its first look — accept it, or send the organiser one Revision Request."}
          {" "}The slot stays held until it is decided.
        </p>
      )}
      {booking.tier_revision_reason &&
        (booking.status === "awaiting_resubmission" ||
          booking.status === "awaiting_tier_review") && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            <p className="font-medium">
              {booking.status === "awaiting_resubmission"
                ? "Revision Request sent — waiting on the organiser to resubmit:"
                : "The Revision Request this Resubmission answers:"}
            </p>
            <p className="mt-1">{booking.tier_revision_reason}</p>
          </div>
        )}

      {anyOpen && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* The quote form's defaults are the office's rules rather than
                this booking's, so they stay assembled here — ADR-0006 refused
                to give the config a second owner and ADR-0007 keeps it out of
                the moves too. */}
            {quoting && (
              <QuoteForm
                bookingId={booking.id}
                reference={reference}
                downpaymentPct={booking.downpayment_pct ?? config.downpayment_pct}
                paymentWindowHours={config.payment_window_hours}
              />
            )}

            {reviewingDocument && (
              <ReviewDocumentAction
                bookingId={booking.id}
                hasOrgDocument={reviewingDocument.hasOrgDocument}
                decline={reviewingDocument.decline}
              />
            )}

            {/* One control per undecided downpayment. verify_payment takes a
                payment id, and a booking can carry more than one attempt. Each
                says whether it can be accepted yet. A discount claim is always
                decided by now (l77b, SCRUM-198). */}
            {verifyingPayment.map(({ payment, accept }) => (
              <VerifyPaymentAction
                key={payment.id}
                payment={payment}
                bookingId={booking.id}
                accept={accept}
              />
            ))}

            {/* Supervisor-gated, exactly as record_balance_payment is. A
                non-supervisor sees why rather than an absent control, which is
                why the blocked case keeps the Actions card open. The reason is
                the module's; this sentence is the screen's. */}
            {recordingBalance.kind === "open" && (
              <RecordBalanceAction
                bookingId={booking.id}
                balanceAmount={recordingBalance.amount}
              />
            )}
            {recordingBalance.kind === "blocked" && (
              <p className="text-sm text-gray-600">
                Only a supervisor can record the in-person balance payment for
                this booking.
              </p>
            )}

            {completing && <CompleteBookingAction bookingId={booking.id} />}

            {/* Never past payment_verification. Decision 6: there is no RPC
                behind it and there should not be. */}
            {rejecting && (
              <RejectBookingAction
                bookingId={booking.id}
                status={booking.status}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* The em dash is this screen's copy for "no code at all", which is
              why the dossier reports that case as null rather than resolving
              it. */}
          <Field label="Classification" value={classificationLabel ?? "—"} />
          <Field label="Event Type" value={booking.event_type_label} />
          <Field
            label="Estimated Headcount"
            value={`${booking.estimated_headcount.toLocaleString()} pax`}
          />
          <Field label="Organizer" value={getOrganizer(booking)} />
          <Field label="Contact Person" value={booking.contact_person} />
          <Field label="Contact Number" value={booking.contact_number} />
          <Field label="Email Address" value={booking.email_address} />
          <Field label="Residency" value={residency} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Venue &amp; Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* From the ROW, not the catalogue. */}
          <Field label="Venue" value={booking.venue_label} />
          {/* Null exactly when the booking names no rate type, so this renders
              the field on the same bookings the rate code did. */}
          {rateTypeLabel && <Field label="Rate Type" value={rateTypeLabel} />}
          <Field label="Event Day" value={formatEventDay(booking.event_date)} />
          <Field label="Start Time" value={booking.start_time.slice(0, 5)} />
          <Field label="End Time" value={endTime} />
          <Field label="Duration" value={`${booking.duration_hours} hours`} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          {booking.total_fee === null ? (
            /* Three em dashes would read as "priced at nothing". */
            <p className="text-sm text-gray-600">
              This booking is awaiting a quote. No fee has been set yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Total Fee" value={formatCurrency(booking.total_fee)} />
              <Field
                /* The row's own percentage, never a hardcoded 50%. */
                label={`Downpayment Due (${
                  booking.downpayment_pct ?? config.downpayment_pct
                }%)`}
                value={formatCurrency(booking.downpayment_amount)}
              />
              <Field
                /*
                  "Due", to match its sibling above. All three of these are the
                  quote broken into parts, not a running ledger:
                  record_balance_payment stamps balance_settled_at and flips the
                  status but deliberately leaves balance_amount at the quoted
                  figure, exactly as downpayment_amount stays put once the
                  downpayment is verified (l36d's header spells this out — an
                  instalment scheme would compare summed payment rows AGAINST
                  this number, so it has to hold still).

                  Which is fine until it sits bare above a payments table on a
                  fully-paid booking, where it reads as money still owed. The
                  settled note is the whole fix: the figure is still the truth
                  of what was quoted, and now it says it has been paid.
                */
                label="Balance Due"
                value={
                  booking.balance_settled_at
                    ? `${formatCurrency(booking.balance_amount)} · settled`
                    : formatCurrency(booking.balance_amount)
                }
              />
            </div>
          )}
          {booking.rehearsal_rate_type && booking.total_fee !== null && (
            /* Decision 10: l55 corrected the card going forward and repriced
               nothing. A booking submitted before it was priced on the old
               flat ₱1,500/hr rate, and that stored figure is what the citizen
               was told and what record_balance_payment will demand. */
            <p className="mt-4 text-xs text-gray-500">
              The stored fee is what this booking was priced at when it was
              submitted. A booking made before the rate card was corrected may
              not equal today&apos;s rate multiplied by its hours.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payments &amp; Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentsCard
            payments={payments}
            documents={documents}
            rateTier={booking.rate_tier}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Special Requirements / Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700">
            {booking.special_requirements ?? "No special requirements provided."}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Declaration</CardTitle>
        </CardHeader>
        <CardContent>
          <Field
            label="Terms &amp; Conditions Accepted"
            value={stamp(booking.terms_accepted_at)}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingTimeline events={events} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Audit</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Quoted By"
            value={
              booking.quoted_by_name
                ? `${booking.quoted_by_name} · ${stamp(booking.quoted_at)}`
                : "—"
            }
          />
          <Field label="Confirmed At" value={stamp(booking.confirmed_at)} />
          <Field
            label="Balance Settled At"
            value={stamp(booking.balance_settled_at)}
          />
          <Field label="Completed At" value={stamp(booking.completed_at)} />
        </CardContent>
      </Card>
    </div>
  );
}
