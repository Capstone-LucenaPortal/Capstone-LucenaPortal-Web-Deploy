'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import ProtectedRoute from '@/portals/citizen/features/auth/components/protected-route';
import { Button, OUTLINED_GHOST_STYLE, WIDE_PRIMARY_STYLE } from '@/portals/citizen/components/ui/button';
import { YellowCardFields } from '@/portals/citizen/features/yellow-card/components/yellow-card-fields';
import { VoterIdUpload } from '@/portals/citizen/features/yellow-card/components/voter-id-upload';
import { catalogService, type CatalogOption, type YellowCardConfig, type YellowCardDocumentType } from '@/portals/citizen/lib/supabase/catalogs';
import { type DocumentUploadProgress } from '@/portals/citizen/lib/storage/file-validation';
import type { SubmittedApplication, YellowCardFieldValues } from '@/portals/citizen/features/yellow-card/types';
import { yellowCardService, YellowCardSubmitError, computeAgeError, liveApplicationNotice, liveNoticeCopy, type LiveApplicationNotice } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import { ReceiptLink } from '@/portals/citizen/features/receipts/components/receipt-link';
import { PROFILE_TAB_YELLOW_CARD } from '@/portals/citizen/features/profile/lib/tabs';
import { AGENCY_NAME } from '@/portals/citizen/lib/contact-info';

interface FormData extends YellowCardFieldValues {
  idFile: File | null;
  privacyConsent: boolean;
}

const EMPTY_FORM: FormData = {
  voterIdNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  dateOfBirth: '',
  genderCode: '',
  civilStatusCode: '',
  completeAddress: '',
  barangayCode: '',
  contactNumber: '',
  emailAddress: '',
  yearsOfResidency: '',
  idFile: null,
  privacyConsent: false,
};

type SubmissionPhase = 'form' | 'submitting' | 'uploading' | 'success' | 'upload-failed';

function YellowCardContent() {
  const router = useRouter();
  const { user } = useAuth();
  void user;

  const [checkingExisting, setCheckingExisting] = useState(true);
  const [liveNotice, setLiveNotice] = useState<LiveApplicationNotice | null>(null);

  const [genders, setGenders] = useState<CatalogOption[]>([]);
  const [civilStatuses, setCivilStatuses] = useState<CatalogOption[]>([]);
  const [barangays, setBarangays] = useState<CatalogOption[]>([]);
  const [config, setConfig] = useState<YellowCardConfig | null>(null);
  const [documentTypes, setDocumentTypes] = useState<YellowCardDocumentType[]>([]);

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [eligibilityError, setEligibilityError] = useState('');

  const [phase, setPhase] = useState<SubmissionPhase>('form');
  const [submitError, setSubmitError] = useState('');
  // Focus target for validation failures, so the message is announced rather
  // than merely rendered somewhere above the fold.
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const [submittedApplication, setSubmittedApplication] = useState<SubmittedApplication | null>(null);
  // Held across retries so a failed/interrupted attempt resumes instead of re-reserving a
  // storage row or re-uploading bytes that already landed. Reset only when a different file
  // is picked — a retry on the SAME file must keep whatever progress was already made.
  const uploadProgress = useRef<DocumentUploadProgress>({});

  // The form uploads a single document because the catalog holds exactly one row.
  // Reading it means a relabel or an is_required flip in Super Staff lands here
  // with no code change; a SECOND catalog row still needs multi-upload work.
  const primaryDocument = documentTypes[0] ?? null;
  const documentLabel = primaryDocument?.label ?? "Voter's ID";
  const documentRequired = primaryDocument?.is_required ?? true;

  useEffect(() => {
    (async () => {
      const [applications, cards, g, c, b, cfg, docs] = await Promise.all([
        yellowCardService.getMyApplications().catch(() => []),
        yellowCardService.getMyCards().catch(() => []),
        catalogService.getGenders().catch(() => []),
        catalogService.getCivilStatuses().catch(() => []),
        catalogService.getBarangays().catch(() => []),
        catalogService.getYellowCardConfig().catch(() => null),
        catalogService.getYellowCardDocumentTypes().catch(() => []),
      ]);
      setLiveNotice(liveApplicationNotice(applications, cards));
      setGenders(g);
      setCivilStatuses(c);
      setBarangays(b);
      setConfig(cfg);
      setDocumentTypes(docs);
      setCheckingExisting(false);
    })();
  }, []);

  useEffect(() => {
    setEligibilityError(computeAgeError(formData.dateOfBirth) ?? '');
  }, [formData.dateOfBirth]);

  const handleInputChange = (field: keyof FormData, value: string | boolean | File | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const attemptUpload = async (application: SubmittedApplication, file: File) => {
    setPhase('uploading');
    try {
      await yellowCardService.uploadVoterIdDocument(application.id, file, uploadProgress.current);
      setPhase('success');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not upload your document. Please try again.');
      setPhase('upload-failed');
    }
  };

  /**
   * Report a validation problem inline and move the citizen to it.
   *
   * Replaces four `alert()` calls. A native alert blocks the thread, cannot be
   * styled, is routinely dismissed before a screen reader finishes reading it,
   * and leaves no trace on the page to return to. Every other form in this app
   * (incident, revise-and-resubmit) already used this inline pattern; the
   * Yellow Card form was the only holdout.
   */
  const failValidation = (message: string) => {
    setSubmitError(message);
    // Focus the banner rather than scrolling to it: scrolling moves the eye but
    // not the screen reader, and the banner is role="alert" + tabIndex={-1}.
    requestAnimationFrame(() => {
      errorBannerRef.current?.focus();
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleSubmit = async () => {
    if (eligibilityError) { failValidation(eligibilityError); return; }
    if (
      !formData.firstName || !formData.lastName || !formData.dateOfBirth ||
      !formData.genderCode || !formData.civilStatusCode || !formData.barangayCode ||
      !formData.completeAddress || !formData.contactNumber || !formData.emailAddress ||
      !formData.yearsOfResidency || !formData.voterIdNumber
    ) {
      failValidation('Please fill in every required field before submitting.');
      return;
    }
    if (!formData.privacyConsent) {
      failValidation('Please accept the Data Privacy consent to submit your application.');
      return;
    }
    if (documentRequired && !formData.idFile) {
      failValidation(`Please upload your ${documentLabel}.`);
      return;
    }

    setSubmitError('');
    setPhase('submitting');
    try {
      const application = await yellowCardService.submitApplication({
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        suffix: formData.suffix || undefined,
        dateOfBirth: formData.dateOfBirth,
        genderCode: formData.genderCode,
        civilStatusCode: formData.civilStatusCode,
        barangayCode: formData.barangayCode,
        completeAddress: formData.completeAddress,
        contactNumber: formData.contactNumber,
        emailAddress: formData.emailAddress,
        yearsOfResidency: Number(formData.yearsOfResidency),
        voterIdNumber: formData.voterIdNumber,
        privacyConsent: formData.privacyConsent,
      });
      setSubmittedApplication(application);
      if (formData.idFile) {
        await attemptUpload(application, formData.idFile);
      } else {
        // Reachable only once the catalog marks the document optional.
        setPhase('success');
      }
    } catch (err) {
      setSubmitError(
        err instanceof YellowCardSubmitError
          ? err.message
          : 'We could not submit your application right now. Please try again later.',
      );
      setPhase('form');
    }
  };

  const handleRetryUpload = () => {
    if (submittedApplication && formData.idFile) {
      void attemptUpload(submittedApplication, formData.idFile);
    }
  };

  const processingDays = config?.processing_time_target_days ?? null;
  const processingCopy = processingDays != null
    ? `${processingDays} business day${processingDays === 1 ? '' : 's'}`
    : 'a few business days';

  if (checkingExisting) {
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#666666' }}>Checking your application status…</p>
      </section>
    );
  }

  // An approved application blocks a new one just as a pending one does, so a
  // cardholder lands here too. `describeLiveApplication` decides which of the
  // three situations this is; the page only renders them.
  if (liveNotice) {
    const { icon, heading, detail } = liveNoticeCopy(liveNotice);
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
        <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
          {heading}
        </h1>
        <p style={{ fontSize: 15, color: '#666666', marginBottom: 24 }}>{detail}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {liveNotice.kind === 'revision' && (
            <Button variant="primary" onClick={() => router.push(`/yellow-card/${liveNotice.applicationId}/revise`)}>
              Revise &amp; Resubmit
            </Button>
          )}
          {liveNotice.kind === 'approved' && (
            <Button variant="primary" onClick={() => router.push(`/profile?tab=${PROFILE_TAB_YELLOW_CARD}`)}>
              View Yellow Card Details
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
        </div>
      </section>
    );
  }

  if (phase === 'success' || phase === 'upload-failed') {
    const reference = submittedApplication?.reference_number ?? '';
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 80, marginBottom: 24 }}>{phase === 'success' ? '✓' : '⚠️'}</div>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
            {phase === 'success' ? 'Yellow Card Application Submitted Successfully!' : 'Application Submitted — Document Upload Failed'}
          </h1>
          <p style={{ fontSize: 16, color: '#666666' }}>
            {phase === 'success'
              ? 'Your application has been received and is now being processed.'
              : "Your application was saved, but we could not upload your Voter's ID. Please retry below."}
          </p>
        </div>

        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ background: '#003DA5', color: 'white', marginBottom: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Your Application Number</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, margin: 0 }}>{reference}</h2>
              <button aria-label="Copy application number" onClick={() => navigator.clipboard.writeText(reference)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 40, height: 40, borderRadius: 4, cursor: 'pointer', fontSize: 18 }}>
                📋
              </button>
            </div>
          </div>
        </div>

        {phase === 'upload-failed' && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 40 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>{submitError}</p>
            <Button variant="primary" onClick={handleRetryUpload}>Retry Upload</Button>
          </div>
        )}

        {phase === 'success' && (
          <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>What Happens Next?</h3>
            <div style={{ display: 'grid', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#003DA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>1</div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#333333', marginBottom: 4 }}>Document Verification</p>
                  <p style={{ fontSize: 13, color: '#666666' }}>Your submitted documents will be verified and validated.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#003DA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>2</div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#333333', marginBottom: 4 }}>Processing &amp; Review</p>
                  {/* TODO(backend): names no office, because which one handles
                    Yellow Cards is unsettled — see `YELLOW_CARD_OFFICE` in
                    `@/lib/contact-info`. Deliberately does NOT read through that
                    constant: this sentence is about what happens, not whom to
                    contact. When SCRUM-105 nominates an office, decide separately
                    whether naming it here helps the citizen. */}
                <p style={{ fontSize: 13, color: '#666666' }}>A reviewer checks your application and the documents you submitted.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#003DA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>3</div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#333333', marginBottom: 4 }}>Card Issuance</p>
                  <p style={{ fontSize: 13, color: '#666666' }}>Once approved, you&#39;ll be notified to claim your Yellow Card at the City Hall or via mail.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ marginBottom: 40, background: '#F5F5F5' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Important Information</h3>
          <ul style={{ fontSize: 13, color: '#333333', lineHeight: 2, listStyle: 'none', paddingLeft: 0 }}>
            <li>• Keep your application number <strong>{reference}</strong> for tracking and reference purposes.</li>
            <li>• The decision on your application appears in your portal inbox — sign in and open your Dashboard to see it.</li>
            <li>• Processing time: {processingCopy} from date of submission.</li>
            <li>• For urgent inquiries, contact us at 8643-0000 (ext. 101-103).</li>
          </ul>
        </div>

        {phase === 'success' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Button variant="primary" onClick={() => router.push('/dashboard')} style={WIDE_PRIMARY_STYLE}>
              View Dashboard
            </Button>
            <ReceiptLink reference={reference} variant="button" />
            <Button variant="ghost" onClick={() => router.push('/')} style={OUTLINED_GHOST_STYLE}>
              Return to Home
            </Button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 24, borderTop: '1px solid #DDDDDD' }}>
          <p style={{ fontSize: 12, color: '#666666' }}>
            Need help tracking your application? Contact us at <a href="mailto:support@lucena-city.gov.ph" style={{ color: '#003DA5', textDecoration: 'none' }}>support@lucena-city.gov.ph</a>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>Get Your Yellow Card</h1>
        <p style={{ fontSize: 16, color: '#666666' }}>Apply for Lucena City&#39;s Yellow Card and unlock exclusive benefits and priority services.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 24, marginBottom: 60 }}>
        {[
          { num: 1, title: 'Submit Documents' },
          { num: 2, title: 'Personal Info' },
          { num: 3, title: 'Contact Details' },
          { num: 4, title: 'Submit' },
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#003DA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
              {step.num}
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#333333', textAlign: 'center' }}>{step.title}</p>
          </div>
        ))}
      </div>

      {eligibilityError && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 32, fontSize: 14, fontWeight: 500 }}>
          {eligibilityError}
        </div>
      )}

      {!eligibilityError && formData.dateOfBirth && (
        <div style={{ background: '#DBEAFE', border: '1px solid #93C5FD', color: '#1E40AF', padding: 16, borderRadius: 4, marginBottom: 32, fontSize: 14, fontWeight: 500 }}>
          ✓ You are eligible to apply for the Yellow Card.
        </div>
      )}

      {submitError && (
        <div
          ref={errorBannerRef}
          role="alert"
          tabIndex={-1}
          style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 32, fontSize: 14, fontWeight: 500 }}
        >
          {submitError}
        </div>
      )}

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40 }}>
        <div>
          <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid #DDDDDD' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>Required Documents</h2>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-text-dark mb-2">
                {documentRequired && <span style={{ color: '#C62828' }}>*</span>} {documentLabel}
              </label>
              <VoterIdUpload
                file={formData.idFile}
                onFile={(file) => {
                  uploadProgress.current = {};
                  setFormData((prev) => ({ ...prev, idFile: file }));
                }}
                title={`Upload ${documentLabel}`}
                hint="Click to select file"
              />
            </div>
          </div>

          <YellowCardFields
            values={formData}
            onChange={(field, value) => handleInputChange(field, value)}
            genders={genders}
            civilStatuses={civilStatuses}
            barangays={barangays}
          />

          {/* The consent statement — text a citizen agrees to, so treat its
              wording as versioned even though the RPC stores only a boolean.
              It names `AGENCY_NAME` rather than the reversed word order it used
              to carry; why that needed no version bump is recorded once in
              `docs/citizen-surface-follow-ups.md` C3. */}
          <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid #DDDDDD' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', fontSize: 14, color: '#333333', lineHeight: 1.6 }}>
              <input
                type="checkbox"
                checked={formData.privacyConsent}
                onChange={(e) => handleInputChange('privacyConsent', e.target.checked)}
                style={{ marginTop: 4, cursor: 'pointer', width: 18, height: 18 }}
              />
              <span><strong>Data Privacy Consent</strong><br />I acknowledge that my personal information will be processed and stored in accordance with the{' '}
<a
  href="https://www.privacy.gov.ph/data-privacy-act/"
  target="_blank"
  rel="noopener noreferrer"
  style={{ color: '#003DA5', textDecoration: 'underline' }}
>
  Data Privacy Act of 2012
</a>
. I understand how my data will be used and give my consent to the {AGENCY_NAME} to process this information for the Yellow Card Program.</span>
            </label>
          </div>

          {/* Deliberately NOT disabled on missing consent. A disabled button
              with no explanation is silence: the citizen clicks, nothing
              happens, and there is nothing to read. Clicking now always
              produces a reason. */}
          <Button variant="primary" onClick={handleSubmit} loading={phase === 'submitting' || phase === 'uploading'} className="w-full text-base font-bold" style={{ paddingTop: 16, paddingBottom: 16 }}>
            {phase === 'submitting' ? 'Submitting…' : phase === 'uploading' ? 'Uploading document…' : 'Submit Application'}
          </Button>
          {!formData.privacyConsent && (
            <p style={{ fontSize: 12, color: '#B45309', textAlign: 'center', marginTop: 12 }}>
              Please accept the Data Privacy consent above to submit.
            </p>
          )}
          {/* Since DB layer `l63` a decision (approved / needs changes / not
              approved) writes a notice, and since `l64` an email goes with it on
              projects where the worker is configured. This copy names only the
              inbox, because one build serves a production project where no
              email is sent at all — see `MyNotification` in
              `@/features/notifications/types`. */}
          <p style={{ fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 16 }}>
            Processing time: {processingCopy}. Updates appear in your portal inbox.
          </p>
        </div>

        <div>
          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ marginBottom: 32, padding: '24px 32px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Yellow Card Benefits</h3>
            <ul style={{ fontSize: 13, color: '#333333', lineHeight: 1.8, listStyle: 'none', paddingLeft: 0 }}>
              <li style={{ marginBottom: 12 }}>✓ Financial assistance for medical, educational, and livelihood needs</li>
              <li style={{ marginBottom: 12 }}>✓ Priority processing for city services</li>
              <li style={{ marginBottom: 12 }}>✓ Access to exclusive community programs</li>
              <li style={{ marginBottom: 12 }}>✓ Discounts at partner establishments</li>
              <li style={{ marginBottom: 12 }}>✓ Free skills training and seminars</li>
            </ul>
          </div>

          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ marginBottom: 32, padding: '24px 32px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Requirements</h3>
            <ul style={{ fontSize: 12, color: '#333333', lineHeight: 1.8, listStyle: 'none', paddingLeft: 0 }}>
              <li>✓ Must be 18 years or older</li>
              <li>✓ Valid Voter&#39;s ID</li>
            </ul>
          </div>

          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>Need Assistance?</h3>
            <p style={{ fontSize: 13, color: '#333333', marginBottom: 12 }}>Contact our Yellow Card helpdesk for application support.</p>
            <p style={{ fontSize: 13, color: '#333333' }}>
              <strong>Phone:</strong> (042) 373-6666<br />
              <strong>Email:</strong> yellowcard@lucena-city.gov.ph
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function YellowCardPage() {
  return (
    <ProtectedRoute>
      <YellowCardContent />
    </ProtectedRoute>
  );
}
