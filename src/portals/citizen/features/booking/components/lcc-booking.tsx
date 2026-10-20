'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import type { BookingFormData } from '@/portals/citizen/features/booking/types';
import { EMPTY_BOOKING_FORM, toDateStr, nextStageAfterSubmit } from '@/portals/citizen/features/booking/lib/schedule';
import type { SubmittedBooking } from '@/portals/citizen/features/booking/types';
import { bookingService, BookingSubmitError } from '@/portals/citizen/features/booking/lib/booking';
import LCCStep1Classification from './steps/lcc-step-1-classification';
import LCCStep2Details        from './steps/lcc-step-2-details';
import LCCStep3Scheduling     from './steps/lcc-step-3-scheduling';
import LCCStep4Review         from './steps/lcc-step-4-review';
import LCCStepOrgDocument   from './steps/lcc-step-org-document';
import LCCStepTierReview    from './steps/lcc-step-tier-review';
import LCCStep5Pending        from './steps/lcc-step-5-pending';
import LCCStep6Payment        from './steps/lcc-step-6-payment';
import LCCStep7Verification   from './steps/lcc-step-7-verification';

const STEPS = [
  { num: 1, label: 'Classification' },
  { num: 2, label: 'Venue & Details' },
  { num: 3, label: 'Scheduling' },
  { num: 4, label: 'Review' },
];

type WizardStage = 1 | 2 | 3 | 4 | 'org-document' | 'tier-review' | 'payment' | 'quote' | 'verification';

export default function LCCBooking() {
  const { user } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<WizardStage>(1);
  const [bookingData, setBookingData] = useState<BookingFormData>(EMPTY_BOOKING_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedBooking, setSubmittedBooking] = useState<SubmittedBooking | null>(null);

  function onUpdate(fields: Partial<BookingFormData>) {
    setBookingData((prev) => ({ ...prev, ...fields }));
  }

  async function handleSubmit() {
    if (!bookingData.selectedDate || !bookingData.startTime) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await bookingService.submitBooking({
        classificationCode: bookingData.classificationCode,
        eventTitle: bookingData.eventTitle,
        eventTypeCode: bookingData.eventTypeCode,
        estimatedHeadcount: Number(bookingData.headcount),
        contactPerson: bookingData.contactPerson,
        contactNumber: bookingData.contactNumber,
        emailAddress: bookingData.emailAddress,
        venueCode: bookingData.venueCode,
        eventDate: toDateStr(bookingData.selectedDate),
        startTime: bookingData.startTime,
        durationHours: Number(bookingData.durationHours),
        organizationName: bookingData.organizationName || undefined,
        specialRequirements: bookingData.specialRequirements || undefined,
        // Hourly venues only — anything else stores a stray rehearsal_rate_type (SCRUM-187).
        rehearsalRateType: bookingData.venueIsHourly ? bookingData.practiceRateType || undefined : undefined,
      });
      setSubmittedBooking(result);
      setStage(nextStageAfterSubmit(result.status));
    } catch (err) {
      setSubmitError(
        err instanceof BookingSubmitError
          ? err.message
          : 'We could not submit your booking right now. Please try again later.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setBookingData(EMPTY_BOOKING_FORM);
    setSubmittedBooking(null);
    setSubmitError('');
    setStage(1);
  }

  function goToDashboard() {
    router.push('/dashboard');
  }

  if (!user) return null;

  const stepProps = { bookingData, onUpdate };
  const numericStage = typeof stage === 'number' ? stage : null;

  return (
    <section style={{ maxWidth: 1400, margin: '0 auto', paddingLeft: 'clamp(16px, 5vw, 48px)', paddingRight: 'clamp(16px, 5vw, 48px)', paddingTop: 48, paddingBottom: 120 }}>
      <div
        className="transition-all duration-300"
        style={{ maxWidth: numericStage && [2, 4].includes(numericStage) ? 1000 : 760, margin: '0 auto' }}
      >
        {numericStage !== null && (
          <div className="flex justify-between relative" style={{ marginBottom: 48 }}>
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#E0E0E0] z-0" />
            {STEPS.map((s) => (
              <div key={s.num} className="relative z-10 text-center">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300"
                  style={{
                    marginBottom: 8,
                    background: numericStage >= s.num ? '#003DA5' : '#F0F0F0',
                    color: numericStage >= s.num ? 'white' : '#666666',
                  }}
                >
                  {numericStage > s.num ? '✓' : s.num}
                </div>
                <div className="text-[11px] font-semibold" style={{ color: numericStage >= s.num ? '#003DA5' : '#666666' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {submitError && stage === 4 && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 24, fontSize: 14 }}>
            {submitError}
          </div>
        )}

        {stage === 1 && <LCCStep1Classification {...stepProps} onNext={() => setStage(2)} />}
        {stage === 2 && <LCCStep2Details        {...stepProps} onNext={() => setStage(3)} onBack={() => setStage(1)} />}
        {stage === 3 && <LCCStep3Scheduling     {...stepProps} onNext={() => setStage(4)} onBack={() => setStage(2)} />}
        {stage === 4 && (
          <LCCStep4Review {...stepProps} onSubmit={handleSubmit} onBack={() => setStage(3)} submitting={submitting} />
        )}
        {stage === 'org-document' && submittedBooking && (
          <LCCStepOrgDocument
            bookingId={submittedBooking.id}
            venueCode={bookingData.venueCode}
            durationHours={Number(bookingData.durationHours)}
            rehearsalRateType={bookingData.venueIsHourly ? bookingData.practiceRateType || null : null}
            // confirm_upload moved the booking to awaiting_tier_review: no
            // payment until City Hall decides the Tier Claim (SCRUM-198).
            onUploaded={() => setStage('tier-review')}
            // give_up_tier_claim repriced it at commercial. Pay what the
            // server set, and route on the status it returned.
            onSkipped={(repriced) => {
              setSubmittedBooking((prev) => prev && {
                ...prev,
                status: repriced.status,
                rate_tier: repriced.rate_tier,
                total_fee: repriced.total_fee,
                downpayment_amount: repriced.downpayment_amount,
              });
              setStage(nextStageAfterSubmit(repriced.status));
            }}
          />
        )}
        {stage === 'tier-review' && submittedBooking && (
          <LCCStepTierReview
            referenceNumber={submittedBooking.reference_number}
            provisionalDownpayment={submittedBooking.downpayment_amount}
            onGoToDashboard={goToDashboard}
            onBookAnother={reset}
          />
        )}
        {stage === 'quote' && submittedBooking && (
          <LCCStep5Pending
            referenceNumber={submittedBooking.reference_number}
            onGoToDashboard={goToDashboard}
            onBookAnother={reset}
          />
        )}
        {stage === 'payment' && submittedBooking && (
          <LCCStep6Payment
            bookingId={submittedBooking.id}
            totalFee={submittedBooking.total_fee}
            downpaymentAmount={submittedBooking.downpayment_amount}
            onSuccess={() => setStage('verification')}
          />
        )}
        {stage === 'verification' && submittedBooking && (
          <LCCStep7Verification
            referenceNumber={submittedBooking.reference_number}
            onGoToDashboard={goToDashboard}
            onBookAnother={reset}
          />
        )}
      </div>
    </section>
  );
}
