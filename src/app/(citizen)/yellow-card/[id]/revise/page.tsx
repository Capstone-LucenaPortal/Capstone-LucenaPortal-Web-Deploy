'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/portals/citizen/features/auth/components/protected-route';
import { Button, OUTLINED_GHOST_STYLE, WIDE_PRIMARY_STYLE } from '@/portals/citizen/components/ui/button';
import { YellowCardFields } from '@/portals/citizen/features/yellow-card/components/yellow-card-fields';
import { VoterIdUpload } from '@/portals/citizen/features/yellow-card/components/voter-id-upload';
import { catalogService, type CatalogOption } from '@/portals/citizen/lib/supabase/catalogs';
import type { MyYellowCardApplication, YellowCardFieldValues } from '@/portals/citizen/features/yellow-card/types';
import { yellowCardService, YellowCardSubmitError, mapApplicationToFormValues, computeAgeError } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import { formatManilaDate } from '@/shared/dates/manila';

type PageState = 'loading' | 'ineligible' | 'form' | 'success';

const BANNER_BASE: React.CSSProperties = {
  padding: 16,
  borderRadius: 4,
  marginBottom: 32,
  fontSize: 14,
  fontWeight: 500,
};

function ReviseContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const applicationId = params.id;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [application, setApplication] = useState<MyYellowCardApplication | null>(null);
  const [values, setValues] = useState<YellowCardFieldValues | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  // Tracks the File that was already successfully uploaded, so a retry after a
  // failed resubmit (the update RPC, after the upload already succeeded) does
  // not re-upload the same file and mint another superseding document row.
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [genders, setGenders] = useState<CatalogOption[]>([]);
  const [civilStatuses, setCivilStatuses] = useState<CatalogOption[]>([]);
  const [barangays, setBarangays] = useState<CatalogOption[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    (async () => {
      const [app, g, c, b] = await Promise.all([
        yellowCardService.getMyApplication(applicationId).catch(() => null),
        catalogService.getGenders().catch(() => []),
        catalogService.getCivilStatuses().catch(() => []),
        catalogService.getBarangays().catch(() => []),
      ]);
      setGenders(g);
      setCivilStatuses(c);
      setBarangays(b);

      // One screen covers four causes: mock mode, a bad id, an id belonging to
      // someone else (the view self-scopes it away), and an application that has
      // already been decided. None of them should hint at which.
      if (!app || app.status !== 'revision_requested') {
        setPageState('ineligible');
        return;
      }
      setApplication(app);
      setValues(mapApplicationToFormValues(app));
      setPageState('form');
    })();
  }, [applicationId]);

  const ageError = values ? computeAgeError(values.dateOfBirth) : null;

  const handleSubmit = async () => {
    if (!application || !values) return;

    // The ageError banner already renders above the form; copying its text
    // into submitError would stack the same message twice.
    if (ageError) return;

    if (
      !values.firstName || !values.lastName || !values.dateOfBirth ||
      !values.genderCode || !values.civilStatusCode || !values.barangayCode ||
      !values.completeAddress || !values.contactNumber || !values.emailAddress ||
      !values.yearsOfResidency || !values.voterIdNumber
    ) {
      setSubmitError('Please fill in all required fields.');
      return;
    }
    if (application.document_count === 0 && !replacementFile) {
      setSubmitError("Please upload your Voter's ID before resubmitting.");
      return;
    }

    setSubmitError('');
    setSubmitting(true);
    try {
      // Upload first, update last. The update RPC is the commit that moves the
      // status to `resubmitted`, and once it has, the RPC refuses a retry with
      // 42501. Doing it last means every failure leaves the application still in
      // `revision_requested` and the whole form retryable as it stands.
      //
      // Skip the upload if this exact file was already uploaded on a prior
      // attempt (e.g. the update RPC failed after a successful upload) — retrying
      // would otherwise mint another document row superseding the one just sent.
      if (replacementFile && replacementFile !== uploadedFile) {
        await yellowCardService.uploadVoterIdDocument(application.id, replacementFile);
        setUploadedFile(replacementFile);
      }
      await yellowCardService.resubmitApplication(application.id, values);
      setPageState('success');
    } catch (err) {
      setSubmitError(
        err instanceof YellowCardSubmitError
          ? err.message
          : 'We could not resubmit your application right now. Please try again later.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#666666' }}>Loading your application…</p>
      </section>
    );
  }

  if (pageState === 'ineligible') {
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>ℹ️</div>
        <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
          We couldn&#39;t find that application
        </h1>
        <p style={{ fontSize: 15, color: '#666666', marginBottom: 24 }}>
          It may have already been reviewed, or it is no longer awaiting your changes.
        </p>
        <Button variant="primary" onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
      </section>
    );
  }

  if (pageState === 'success') {
    const reference = application?.reference_number ?? '';
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 80, marginBottom: 24 }}>✓</div>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
            Application Resubmitted
          </h1>
          <p style={{ fontSize: 16, color: '#666666' }}>
            {/* TODO(backend): named an office before; see `YELLOW_CARD_OFFICE`
                in `@/lib/contact-info` for why none is named now. Does not read
                through that constant — revisit when SCRUM-105 lands. */}
            Your changes have been submitted for review.
          </p>
        </div>

        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ background: '#003DA5', color: 'white', marginBottom: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Your Application Number</p>
            <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, margin: 0 }}>{reference}</h2>
          </div>
        </div>

        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ marginBottom: 40, background: '#F5F5F5' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>What Happens Next?</h3>
          <ul style={{ fontSize: 13, color: '#333333', lineHeight: 2, listStyle: 'none', paddingLeft: 0 }}>
            {/* No status label in this list. The heading above already says
                "Application Resubmitted" — the DB and Staff name — while the
                citizen's own dashboard badge reads "Pending Review" for
                `resubmitted`. Naming either here contradicts the other surface,
                which is how this line came to claim both (issue #9). The why is
                in `features/dashboard/lib/status.test.ts`. */}
            <li>• Your application has returned to the review queue.</li>
            <li>• A reviewer will look at your updated details and documents.</li>
            <li>• The decision on your application appears in your portal inbox — sign in and open your Dashboard to see it.</li>
            <li>• Keep your application number <strong>{reference}</strong> for tracking purposes.</li>
          </ul>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Button variant="primary" onClick={() => router.push('/dashboard')} style={WIDE_PRIMARY_STYLE}>
            View Dashboard
          </Button>
          <Button variant="ghost" onClick={() => router.push('/')} style={OUTLINED_GHOST_STYLE}>
            Return to Home
          </Button>
        </div>
      </section>
    );
  }

  // pageState === 'form'
  const app = application!;
  const formValues = values!;

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
          Revise Your Yellow Card Application
        </h1>
        <p style={{ fontSize: 16, color: '#666666' }}>Application #{app.reference_number}</p>
      </div>

      <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderLeft: '4px solid #F97316', borderRadius: 4, padding: 20, marginBottom: 32 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#9A3412', marginBottom: 8 }}>
          ⚠️ What the reviewer asked you to fix
        </p>
        <p style={{ fontSize: 15, color: '#333333', lineHeight: 1.6 }}>
          {app.current_reason ?? 'No reason was recorded. Please check your details and documents before resubmitting.'}
        </p>
        {app.current_reviewed_at && (
          <p style={{ fontSize: 12, color: '#9A3412', marginTop: 12 }}>Reviewed {formatManilaDate(app.current_reviewed_at)}</p>
        )}
      </div>

      {ageError && <div style={{ ...BANNER_BASE, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>{ageError}</div>}
      {submitError && <div style={{ ...BANNER_BASE, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>{submitError}</div>}

      <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid #DDDDDD' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Voter&#39;s ID</h2>
        {app.document_count === 0 ? (
          <p style={{ fontSize: 13, color: '#C62828', marginBottom: 16 }}>
            No document is on file. Please upload your Voter&#39;s ID to resubmit.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: '#666666', marginBottom: 16 }}>
            ✓ {app.document_count} document{app.document_count === 1 ? '' : 's'} on file — optional, leave blank to keep what you already uploaded.
          </p>
        )}
        <VoterIdUpload
          file={replacementFile}
          onFile={setReplacementFile}
          title="Replace Voter's ID"
          hint="Click to select a new file"
        />
      </div>

      <YellowCardFields
        values={formValues}
        onChange={(field, value) => setValues((prev) => (prev ? { ...prev, [field]: value } : prev))}
        genders={genders}
        civilStatuses={civilStatuses}
        barangays={barangays}
      />

      <Button
        variant="primary"
        onClick={handleSubmit}
        loading={submitting}
        className="w-full text-base font-bold"
        style={{ paddingTop: 16, paddingBottom: 16 }}
      >
        {submitting ? 'Resubmitting…' : 'Resubmit Application'}
      </Button>
      <p style={{ fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 16 }}>
        Resubmitting returns your application to the review queue.
      </p>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ fontSize: 14, color: '#666666', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Cancel and go back to Dashboard
        </button>
      </div>
    </section>
  );
}

export default function ReviseYellowCardPage() {
  return (
    <ProtectedRoute>
      <ReviseContent />
    </ProtectedRoute>
  );
}
