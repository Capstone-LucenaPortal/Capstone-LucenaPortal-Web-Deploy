'use client';

import { useEffect, useId, useState } from 'react';
import type { MyBooking } from '@/portals/citizen/features/booking/types';
import { cancelBooking } from '@/portals/citizen/features/booking/lib/booking';
import LCCStep6Payment from '@/portals/citizen/features/booking/components/steps/lcc-step-6-payment';
import LCCStepOrgDocument from '@/portals/citizen/features/booking/components/steps/lcc-step-org-document';
import { formatPHP } from '@/portals/citizen/features/booking/lib/schedule';
import {
  actionRow,
  inlineError,
  inlineNotice,
  primaryAction,
  reasonTextarea,
  secondaryAction,
} from '../lib/action-styles';

interface Props {
  booking: MyBooking;
  onChanged: () => void;
}

/** Statuses a citizen may cancel from. Anything later involves money that has
 * already changed hands, and anything terminal has nothing left to cancel.
 * The DB is the authority — this only decides which control to render, so a
 * citizen is never shown a button whose only outcome is a refusal. The two
 * Tier Review statuses are cancellable too: no money is on file (DB l77b). */
const CANCELLABLE = new Set([
  'pending',
  'awaiting_tier_review',
  'awaiting_resubmission',
  'awaiting_quote',
  'awaiting_payment',
]);

/** Statuses where cancelling means talking to a human about a refund. */
const PAYMENT_ON_FILE = new Set(['payment_verification', 'confirmed', 'fully_paid']);

/** Statuses whose Hold is the citizen's to beat — the countdown ticks on these. */
const HOLD_RUNNING = new Set(['pending', 'awaiting_resubmission', 'awaiting_payment']);

/** Copy per `booking_cancellation_reason`. A bare "Cancelled" told a citizen
 * nothing about whether they had been rejected, had cancelled themselves, or
 * had simply run out the payment clock. */
const CANCELLATION_COPY: Record<string, string> = {
  rejected_by_staff: 'This booking was not approved by City Hall.',
  cancelled_by_citizen: 'You cancelled this booking.',
  expired_unpaid: 'This booking was released because the downpayment was not received before the hold expired.',
  expired_unrevised:
    'This booking was released because a corrected organisation document was not uploaded before the Revision Request expired.',
  no_show: 'This booking was closed as a no-show.',
};

/**
 * Pure: a human countdown to `hold_expires_at`, or null once it has passed.
 * Whole minutes — a second-by-second countdown on a multi-hour hold is noise,
 * and the sweeper that acts on this works in coarser units anyway.
 */
export function formatHoldRemaining(holdExpiresAt: string | null, now: number): string | null {
  if (!holdExpiresAt) return null;
  const expires = new Date(holdExpiresAt).getTime();
  if (Number.isNaN(expires)) return null;
  const ms = expires - now;
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export default function BookingCardActions({ booking, onChanged }: Props) {
  const [showCancel, setShowCancel] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const reasonId = useId();

  const isAwaitingPayment = booking.status === 'awaiting_payment';
  const holdRunning = HOLD_RUNNING.has(booking.status);

  // A commercial booking carrying a Revision Request's reason had its Tier
  // Claim rejected on the second look and was repriced (DB l77b header §6):
  // the citizen now decides whether to pay at that rate or cancel.
  const claimRejected = booking.rate_tier === 'commercial' && booking.tier_revision_reason != null;

  // Only tick while a hold is actually counting down.
  useEffect(() => {
    if (!holdRunning || !booking.hold_expires_at) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [holdRunning, booking.hold_expires_at]);

  const submitCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelBooking(booking.id, reason, booking.status);
      setShowCancel(false);
      setReason('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not cancel that booking right now.');
    } finally {
      setBusy(false);
    }
  };

  const holdRemaining = formatHoldRemaining(booking.hold_expires_at, now);

  const cancelToggle = (
    <button
      type="button"
      disabled={busy}
      aria-expanded={showCancel}
      onClick={() => setShowCancel((v) => !v)}
      style={secondaryAction(busy)}
    >
      Cancel booking
    </button>
  );

  // The organisation-document upload, for a Tier Claim the citizen still owes
  // a document on. Only while the Hold runs: confirm_upload refuses after it.
  // The REPLACEMENT (resubmission) is offered in awaiting_resubmission alone,
  // and never on an accepted claim — SCRUM-196: an accepted document must not
  // be swappable. The server refuses it too; this keeps the control honest.
  const uploadMode =
    !holdRemaining || booking.tier_verified
      ? null
      : booking.status === 'pending'
        ? 'claim'
        : booking.status === 'awaiting_resubmission'
          ? 'resubmission'
          : null;

  return (
    <div>
      {/* pending — a discounted booking still waiting for its organisation
          document, e.g. a citizen who left the wizard on the upload screen. */}
      {booking.status === 'pending' && (
        <div style={inlineNotice}>
          Upload your organisation document so City Hall can review your discount — or continue at
          the commercial rate.
          {booking.hold_expires_at && (
            <div style={{ marginTop: 4 }}>
              {holdRemaining
                ? `Your slot is held — ${holdRemaining}.`
                : 'The hold on your slot has expired. City Hall may have released this date.'}
            </div>
          )}
        </div>
      )}

      {/* awaiting_tier_review — City Hall's turn. No Hold, no payment. */}
      {booking.status === 'awaiting_tier_review' && (
        <div style={inlineNotice}>
          Your discount claim is under review. No payment is due yet, and your date stays held.
          <div style={{ marginTop: 4 }}>
            {booking.downpayment_amount != null
              ? `Downpayment: ${formatPHP(booking.downpayment_amount)} if your discount claim is accepted.`
              : 'If your discount claim is accepted, City Hall will send you a quote before you pay.'}
          </div>
        </div>
      )}

      {/* awaiting_resubmission — the one Revision Request. */}
      {booking.status === 'awaiting_resubmission' && (
        <div style={inlineNotice}>
          <strong>Your organisation document needs a correction.</strong>
          {booking.tier_revision_reason && (
            <div style={{ marginTop: 4 }}>{booking.tier_revision_reason}</div>
          )}
          <div style={{ marginTop: 4 }}>
            {holdRemaining
              ? `Upload a corrected document to keep this booking — ${holdRemaining}.`
              : 'The time to upload a corrected document has passed. City Hall may have released this date.'}
          </div>
        </div>
      )}

      {uploadMode && (
        <div style={{ marginTop: 16 }}>
          <LCCStepOrgDocument
            bookingId={booking.id}
            venueCode={booking.venue_code ?? ''}
            durationHours={booking.duration_hours}
            rehearsalRateType={booking.rehearsal_rate_type}
            mode={uploadMode}
            onUploaded={onChanged}
            onSkipped={uploadMode === 'claim' ? onChanged : undefined}
          />
        </div>
      )}

      {/* awaiting_payment — the resumable "Pay Now" entry point. Until now
          LCCStep6Payment was reachable only inside a live wizard session, so a
          booking quoted after the citizen closed the tab had no screen
          anywhere that let them pay, despite LCCStep5Pending promising one. */}
      {isAwaitingPayment && (
        <>
          {claimRejected && (
            <div style={inlineNotice}>
              <strong>Your organisation document was not accepted</strong>, so this booking is now at
              the commercial rate. Pay the downpayment below to keep it, or cancel the booking if you
              no longer want it at that rate.
            </div>
          )}
          <div style={inlineNotice}>
            <strong>Downpayment due: {booking.downpayment_amount != null ? formatPHP(booking.downpayment_amount) : '—'}</strong>
            {booking.downpayment_pct != null && ` (${booking.downpayment_pct}% of the total fee)`}
            {booking.hold_expires_at && (
              <div style={{ marginTop: 4 }}>
                {holdRemaining
                  ? `Your slot is held — ${holdRemaining}.`
                  : 'The hold on your slot has expired. City Hall may have released this date.'}
              </div>
            )}
          </div>
          {!showPayment && (
            // Pay and cancel side by side: after a rejected claim, paying is
            // choosing to continue at the commercial rate and cancelling is
            // the other choice.
            <div style={actionRow}>
              <button
                type="button"
                onClick={() => setShowPayment(true)}
                style={primaryAction('#2563EB')}
              >
                Pay downpayment
              </button>
              {cancelToggle}
            </div>
          )}
          {showPayment && (
            <div style={{ marginTop: 16 }}>
              <LCCStep6Payment
                bookingId={booking.id}
                totalFee={booking.total_fee}
                downpaymentAmount={booking.downpayment_amount}
                onSuccess={() => {
                  setShowPayment(false);
                  onChanged();
                }}
              />
            </div>
          )}
        </>
      )}

      {booking.status === 'awaiting_quote' && (
        <div style={inlineNotice}>
          City Hall is preparing your quote. A notice appears in your portal inbox once the
          fee is set, and you can pay the downpayment from this page.
        </div>
      )}

      {/* confirmed — the balance is payable in person. */}
      {(booking.status === 'confirmed' || booking.status === 'fully_paid') && booking.balance_amount != null && (
        <div style={inlineNotice}>
          {booking.balance_settled_at
            ? `Balance of ${formatPHP(booking.balance_amount)} settled.`
            : `Balance of ${formatPHP(booking.balance_amount)} is payable in person at the Lucena City Hall cashier before your event.`}
        </div>
      )}

      {booking.status === 'cancelled' && (
        <div style={inlineNotice}>
          {(booking.cancellation_reason && CANCELLATION_COPY[booking.cancellation_reason]) ??
            'This booking is no longer active.'}
        </div>
      )}

      {/* Cancellation. A booking with money on file gets contact copy instead
          of a button whose only possible outcome is a refusal. On an
          awaiting_payment booking the toggle sits beside Pay, above. */}
      {CANCELLABLE.has(booking.status) && !showPayment && (
        <>
          {!isAwaitingPayment && <div style={actionRow}>{cancelToggle}</div>}
          {showCancel && (
            <div style={{ marginTop: 12 }}>
              <label
                htmlFor={reasonId}
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
              >
                Why are you cancelling?
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={reasonTextarea}
                placeholder="This helps City Hall plan the venue calendar."
                aria-invalid={error ? true : undefined}
              />
              <div style={actionRow}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitCancel()}
                  style={primaryAction('#DC2626', busy)}
                >
                  {busy ? 'Cancelling…' : 'Confirm cancellation'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {PAYMENT_ON_FILE.has(booking.status) && (
        <div style={{ fontSize: 12, color: '#666666', marginTop: 10 }}>
          Need to cancel? A payment is already on file, so please contact the Lucena City Hall
          trunkline to cancel or request a refund.
        </div>
      )}

      {error && (
        <p role="alert" style={inlineError}>
          {error}
        </p>
      )}
    </div>
  );
}
