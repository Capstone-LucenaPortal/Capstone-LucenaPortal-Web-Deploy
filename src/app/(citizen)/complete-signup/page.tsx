'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authService } from '@/portals/citizen/features/auth/lib/auth';
import { catalogService, type CatalogOption } from '@/portals/citizen/lib/supabase/catalogs';
import type { CitizenProfileFields } from '@/portals/citizen/features/auth/types';
import { LIMITS } from '@/portals/citizen/lib/validation';

type Outcome = 'loading' | 'no-session' | 'exists' | 'completed' | 'not-a-citizen' | 'incomplete';

export default function CompleteSignupPage() {
  const [outcome, setOutcome] = useState<Outcome>('loading');
  const [barangays, setBarangays] = useState<CatalogOption[]>([]);
  const [genders, setGenders] = useState<CatalogOption[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Form state — pre-filled from user_metadata (best-effort, may be partial).
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [genderCode, setGenderCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [barangayCode, setBarangayCode] = useState('');
  const [street, setStreet] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [workingInLucena, setWorkingInLucena] = useState('yes');
  const [occupation, setOccupation] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user) { setOutcome('no-session'); return; }

        const result = await authService.ensureCitizenProfile();
        setOutcome(result);
        if (result !== 'incomplete') return;

        const [b, g, meta] = await Promise.all([
          catalogService.getBarangays().catch(() => []),
          catalogService.getGenders().catch(() => []),
          authService.getCurrentUserMetadata().catch(() => null),
        ]);
        setBarangays(b);
        setGenders(g);

        if (meta) {
          const str = (v: unknown) => (typeof v === 'string' ? v : '');
          setFirstName(str(meta.firstName));
          setLastName(str(meta.lastName));
          setMiddleName(str(meta.middleName));
          setSuffix(str(meta.suffix));
          setBirthDate(str(meta.birthDate));
          setGenderCode(str(meta.genderCode));
          setMobile(str(meta.mobile));
          setBarangayCode(str(meta.barangayCode));
          setStreet(str(meta.street));
          setHouseNo(str(meta.houseNo));
          setOccupation(str(meta.occupation));
        }
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!agreedToTerms) {
      setError('You must agree to the Terms and Conditions and Privacy Policy.');
      return;
    }
    setSubmitting(true);
    try {
      const fields: CitizenProfileFields = {
        firstName, lastName, middleName, suffix,
        birthDate, genderCode, mobile, barangayCode,
        street, houseNo,
        occupation: workingInLucena === 'yes' ? occupation : '',
        worksInLucena: workingInLucena === 'yes',
        agreedToTerms,
      };
      await authService.completeProfile(fields);
      setOutcome('completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete your profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border border-[#CCCCCC] rounded p-3 text-sm';
  const labelClass = 'block text-sm font-semibold text-text-dark mb-1';

  if (outcome === 'loading') {
    if (loadError) {
      return (
        <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
          <h1 className="text-2xl font-bold text-lucena-blue">Something went wrong</h1>
          <p className="mt-3 text-sm">
            We couldn&apos;t set up your account right now. Please check your connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-lucena-blue text-white rounded p-3 mt-4"
          >
            Try Again
          </button>
        </main>
      );
    }
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
        <p className="text-sm text-dark-gray">Setting up your account…</p>
      </main>
    );
  }

  if (outcome === 'no-session') {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
        <h1 className="text-2xl font-bold text-lucena-blue">Link expired</h1>
        <p className="mt-3 text-sm">
          This confirmation link may have expired or already been used. Please sign in.
        </p>
        <Link href="/" className="text-lucena-blue underline text-sm mt-3 inline-block">Go home</Link>
      </main>
    );
  }

  if (outcome === 'exists' || outcome === 'completed') {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
        <h1 className="text-2xl font-bold text-lucena-blue">You&apos;re all set!</h1>
        <p className="mt-3 text-sm">Your account and profile are ready.</p>
        <a
          href="/dashboard"
          className="w-full bg-lucena-blue text-white rounded p-3 mt-4 inline-block text-center"
        >
          Go to Dashboard
        </a>
      </main>
    );
  }

  if (outcome === 'not-a-citizen') {
    return (
      <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
        <p className="text-sm text-dark-gray">This confirmation link doesn&apos;t apply to your account.</p>
        <Link href="/" className="text-lucena-blue underline text-sm mt-3 inline-block">Go home</Link>
      </main>
    );
  }

  // outcome === 'incomplete' — fallback completion form
  return (
    <main style={{ maxWidth: 560, margin: '60px auto', padding: 24 }}>
      <h1 className="text-2xl font-bold text-lucena-blue">Finish setting up your account</h1>
      <p className="mt-2 mb-6 text-sm text-dark-gray">
        Your email is confirmed — we just need a few more details to complete your profile.
      </p>

      <div className="flex flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ flex: '0 0 calc(33.333% - 8px)' }}>
          <label htmlFor="signup-first-name" className={labelClass}>First Name *</label>
          <input id="signup-first-name" className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={LIMITS.name} />
        </div>
        <div style={{ flex: '0 0 calc(33.333% - 8px)' }}>
          <label htmlFor="signup-last-name" className={labelClass}>Last Name *</label>
          <input id="signup-last-name" className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={LIMITS.name} />
        </div>
        <div style={{ flex: '0 0 calc(33.333% - 8px)' }}>
          <label htmlFor="signup-middle-name" className={labelClass}>Middle Name</label>
          <input id="signup-middle-name" className={inputClass} value={middleName} onChange={(e) => setMiddleName(e.target.value)} maxLength={LIMITS.name} />
        </div>
      </div>

      <div className="flex flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <label htmlFor="signup-birth-date" className={labelClass}>Birth Date *</label>
          <input id="signup-birth-date" className={inputClass} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} min="1906-01-01" />
        </div>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <label htmlFor="signup-sex" className={labelClass}>Sex *</label>
          <select id="signup-sex" className={inputClass} value={genderCode} onChange={(e) => setGenderCode(e.target.value)}>
            <option value="">Select Sex</option>
            {genders.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <label htmlFor="signup-mobile" className={labelClass}>Mobile Number</label>
          <input
            id="signup-mobile"
            className={inputClass}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="09XXXXXXXXX"
            maxLength={11}
          />
        </div>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <label htmlFor="signup-barangay" className={labelClass}>Barangay *</label>
          <select id="signup-barangay" className={inputClass} value={barangayCode} onChange={(e) => setBarangayCode(e.target.value)}>
            <option value="">Select Barangay</option>
            {barangays.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <label htmlFor="signup-house-no" className={labelClass}>House #</label>
          <input id="signup-house-no" className={inputClass} value={houseNo} onChange={(e) => setHouseNo(e.target.value)} maxLength={LIMITS.address} />
        </div>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <label htmlFor="signup-street" className={labelClass}>Street</label>
          <input id="signup-street" className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} maxLength={LIMITS.address} />
        </div>
      </div>

      <div className="flex flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <span id="signup-working-in-lucena" className={labelClass}>Working in Lucena City?</span>
          <div role="radiogroup" aria-labelledby="signup-working-in-lucena" className="flex items-center" style={{ gap: 20, paddingTop: 9 }}>
            {['yes', 'no'].map((v) => (
              <label key={v} className="flex items-center text-sm" style={{ gap: 6 }}>
                <input
                  type="radio"
                  name="workingInLucena"
                  value={v}
                  checked={workingInLucena === v}
                  onChange={() => setWorkingInLucena(v)}
                />
                {v === 'yes' ? 'Yes' : 'No'}
              </label>
            ))}
          </div>
        </div>
        <div style={{ flex: '0 0 calc(50% - 6px)' }}>
          <label htmlFor="signup-occupation" className={labelClass}>Occupation</label>
          <input
            id="signup-occupation"
            className={inputClass}
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            disabled={workingInLucena === 'no'}
            maxLength={LIMITS.shortText}
          />
        </div>
      </div>

      <label className="flex items-start text-xs text-dark-gray leading-relaxed" style={{ gap: 10, marginTop: 16, marginBottom: 12 }}>
        <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-0.5" />
        <span>
          I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-lucena-blue underline">Terms and Conditions</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-lucena-blue underline">Privacy Policy</a>.
        </span>
      </label>

      {error && <p className="text-lucena-error text-sm mb-3">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting} className="w-full bg-lucena-blue text-white rounded p-3">
        {submitting ? 'Saving…' : 'Complete My Profile'}
      </button>
    </main>
  );
}
