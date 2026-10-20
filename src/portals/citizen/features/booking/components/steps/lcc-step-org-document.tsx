'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/portals/citizen/components/ui/button';
import { bookingService, BookingSubmitError } from '@/portals/citizen/features/booking/lib/booking';
import { estimateDownpayment, estimateVenueFee, formatPHP } from '@/portals/citizen/features/booking/lib/schedule';
import type { FeeEstimate, SubmittedBooking } from '@/portals/citizen/features/booking/types';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';
import { validateUploadFile, MAX_UPLOAD_BYTES, type DocumentUploadProgress } from '@/portals/citizen/lib/storage/file-validation';

interface Props {
  bookingId: string;
  /** What the booking is, so the skip can show the commercial downpayment it
   * would cost. Display-only: the server sets the real price. */
  venueCode: string;
  durationHours: number;
  rehearsalRateType: string | null;
  /**
   * `claim` — the first upload, on a `pending` booking: upload, or give up the
   * discount. `resubmission` — a corrected upload answering a Revision Request,
   * on an `awaiting_resubmission` booking: no skip.
   */
  mode?: 'claim' | 'resubmission';
  onUploaded: () => void;
  /** `claim` mode only. Receives the booking as `give_up_tier_claim` repriced it. */
  onSkipped?: (booking: SubmittedBooking) => void;
}

type Phase = 'form' | 'uploading' | 'upload-failed' | 'upload-refused' | 'skipping';

/**
 * The organisation document behind a discount claim (Tier Claim).
 *
 * Since DB l77b (SCRUM-198) a discounted booking takes no downpayment until
 * City Hall has decided its Tier Claim. `submit_booking` leaves it `pending`;
 * confirming this upload moves it to `awaiting_tier_review`, where staff
 * accept it, issue one Revision Request, or (on the second look) reject it.
 * Only then is the citizen asked to pay, at a price the city has confirmed.
 *
 * The skip is a server action, `give_up_tier_claim`: the citizen gives up the
 * discount and the booking is repriced at the commercial rate and continues
 * to payment (or to a quote). Its copy shows the commercial downpayment, so
 * the citizen knows what they are choosing. The Hold that started at
 * submission keeps running on this screen — it is the citizen's turn.
 *
 * `resubmission` mode is the same upload answering a Revision Request; the
 * server accepts an organisation document only in `pending` and
 * `awaiting_resubmission`, so an accepted document can never be replaced
 * (SCRUM-196).
 */
export default function LCCStepOrgDocument({
  bookingId,
  venueCode,
  durationHours,
  rehearsalRateType,
  mode = 'claim',
  onUploaded,
  onSkipped,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [skipError, setSkipError] = useState('');
  const [refusal, setRefusal] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [commercialDownpayment, setCommercialDownpayment] = useState<FeeEstimate | null>(null);
  // Held across retries so a failed/interrupted attempt resumes instead of re-reserving a
  // storage row or re-uploading bytes that already landed. Reset only when a different file
  // is picked — a retry on the SAME file must keep whatever progress was already made.
  const uploadProgress = useRef<DocumentUploadProgress>({});
  const canSkip = mode === 'claim' && onSkipped !== undefined;

  useEffect(() => {
    if (!canSkip) return;
    let live = true;
    Promise.all([
      catalogService.getBookingVenueRates().catch(() => []),
      catalogService.getBookingConfig().catch(() => null),
      catalogService.getRehearsalRates().catch(() => []),
    ]).then(([rates, config, rehearsalRates]) => {
      if (!live) return;
      const rate = rates.find((r) => r.venue_code === venueCode && r.tier === 'commercial');
      // Hourly venues only: the rehearsal rate is keyed on its rate type, not on tier.
      const rehearsalHourly = rehearsalRateType
        ? rehearsalRates.find((r) => r.code === rehearsalRateType)?.hourly_rate ?? null
        : null;
      const fee = estimateVenueFee(rate, durationHours, rehearsalHourly);
      setCommercialDownpayment(estimateDownpayment(fee, config?.downpayment_pct ?? 50));
    });
    return () => {
      live = false;
    };
  }, [canSkip, venueCode, durationHours, rehearsalRateType]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const problem = await validateUploadFile(picked, 'imageOrPdf');
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError('');
    setPhase('form');
    uploadProgress.current = {};
    setFile(picked);
  }

  const attemptUpload = async (picked: File) => {
    setPhase('uploading');
    try {
      // No paymentId — that argument is gcash_receipt-only, and the database has
      // a CHECK each way.
      await bookingService.uploadBookingDocument(bookingId, 'org_document', picked, undefined, uploadProgress.current);
      onUploaded();
    } catch (err) {
      // 42501 is permanent: the Hold has ended, or the booking has moved past
      // accepting this document (confirm_upload, DB l77b). A retry cannot
      // succeed, so say why — translateBookingError already wrote it for a
      // citizen. Anything else gets a retry, and its message is not rendered:
      // the remaining causes are not ones a citizen can act on beyond retrying.
      if (err instanceof BookingSubmitError && err.code === '42501') {
        setRefusal(err.message);
        setPhase('upload-refused');
        return;
      }
      setPhase('upload-failed');
    }
  };

  const skip = async () => {
    if (!onSkipped) return;
    setSkipError('');
    setPhase('skipping');
    try {
      onSkipped(await bookingService.giveUpTierClaim(bookingId));
    } catch (err) {
      // giveUpTierClaim throws BookingSubmitError with citizen copy already.
      setSkipError(err instanceof Error ? err.message : 'We could not continue right now. Please try again.');
      setPhase('form');
    }
  };

  const busy = phase === 'uploading' || phase === 'skipping';

  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>
        {mode === 'resubmission' ? 'Upload a Corrected Document' : 'Proof of Organisation'}
      </h2>
      <p style={{ color: '#666666', marginBottom: 24, fontSize: 14 }}>
        {mode === 'resubmission'
          ? 'Upload a corrected organisation document for the same booking. City Hall will review it once more — your date and booking reference stay the same.'
          : <>Your organisation type qualifies for a discounted venue rate. Upload a document that
            shows your organisation&apos;s status — for example a registration certificate, an
            accreditation, or an official letterhead. City Hall reviews it before you pay anything,
            so you only ever pay a price that has been confirmed.</>}
      </p>

      {phase === 'upload-refused' && (
        <div role="alert" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 24, fontSize: 13 }}>
          {refusal} Check your dashboard for where this booking stands now.
        </div>
      )}

      {phase === 'upload-failed' && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 24 }}>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            We could not upload your document. Your booking is safe — please try again.
          </p>
          <Button variant="primary" onClick={() => { if (file) void attemptUpload(file); }}>
            Retry Upload
          </Button>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label htmlFor={`booking-org-document-${bookingId}`} className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>
          Organisation Document
        </label>
        <div
          style={{
            border: '2px dashed #E2E8F0',
            borderRadius: 8,
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative',
            background: file ? '#F0FDF4' : 'white',
            borderColor: file ? '#86EFAC' : '#E2E8F0',
          }}
        >
          <input
            id={`booking-org-document-${bookingId}`}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleFile}
            disabled={busy}
            style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
          <div style={{ fontSize: 24, marginBottom: 8 }}>{file ? '✅' : '📎'}</div>
          <span style={{ fontSize: 13, color: file ? '#166534' : '#666666', fontWeight: file ? 600 : 400 }}>
            {file ? `Selected: ${file.name}` : `Click to upload a JPG, PNG or PDF (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`}
          </span>
        </div>
        {fileError && <p style={{ color: '#C62828', fontSize: 11, marginTop: 4 }}>{fileError}</p>}
      </div>

      <Button
        variant="primary"
        onClick={() => { if (file) void attemptUpload(file); }}
        disabled={!file || busy}
        loading={phase === 'uploading'}
        className="w-full text-base font-bold rounded-lg"
        style={{ paddingTop: 16, paddingBottom: 16 }}
      >
        {phase === 'uploading'
          ? 'Uploading document…'
          : mode === 'resubmission'
            ? 'Upload Corrected Document'
            : 'Upload and Send for Review'}
      </Button>

      {canSkip && (
        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 20, borderTop: '1px solid #E2E8F0' }}>
          <p style={{ fontSize: 13, color: '#B45309', marginBottom: 12, lineHeight: 1.5 }}>
            No document to hand? Continuing without one gives up the discounted rate. Your booking
            continues at commercial pricing
            {commercialDownpayment == null
              ? '.'
              : commercialDownpayment.requiresQuote
                ? ' — City Hall will quote the commercial price before you pay.'
                : commercialDownpayment.amount != null
                  ? <>, with a downpayment of <strong>{formatPHP(commercialDownpayment.amount)}</strong>.</>
                  : '.'}
          </p>
          <button
            type="button"
            onClick={() => void skip()}
            disabled={busy}
            style={{ background: 'none', border: 'none', color: '#003DA5', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {phase === 'skipping' ? 'Continuing…' : 'Continue at the commercial rate'}
          </button>
          {skipError && (
            <p role="alert" style={{ color: '#C62828', fontSize: 12, marginTop: 8 }}>
              {skipError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
