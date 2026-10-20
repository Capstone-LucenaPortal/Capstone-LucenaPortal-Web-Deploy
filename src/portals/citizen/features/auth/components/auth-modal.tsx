'use client';

import { useState, useEffect, useId } from 'react';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { Button } from '@/portals/citizen/components/ui/button';
import ModalShell, { ModalCloseButton } from '@/portals/citizen/components/ui/modal-shell';
import { PhoneInput } from '@/portals/citizen/components/ui/phone-input';
import { catalogService, type CatalogOption } from '@/portals/citizen/lib/supabase/catalogs';
import { authService, MIN_ACCOUNT_AGE_YEARS } from '@/portals/citizen/features/auth/lib/auth';
import { validatePassword, PASSWORD_RULES_TEXT } from '@/portals/citizen/features/auth/lib/password-policy';
import { LIMITS, birthDateError } from '@/portals/citizen/lib/validation';

export default function AuthModal() {
  const { login, signup, closeAuthModal, showAuthModal, authMode: mode, setAuthMode: setMode } = useAuth();

  // One stable prefix per mounted modal. Every label/input pair below derives
  // its id from it, so screen readers announce a field name instead of the bare
  // "edit text" they got when no <label> carried an htmlFor.
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const headingId = fid('heading');
  const errorId = fid('form-error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'sent'>('email');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetSending, setResetSending] = useState(false);

  // Sign-up fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [barangay, setBarangay] = useState('');
  const [street, setStreet] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [workingInLucena, setWorkingInLucena] = useState('yes');
  const [occupation, setOccupation] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [barangays, setBarangays] = useState<CatalogOption[]>([]);
  useEffect(() => { catalogService.getBarangays().then(setBarangays).catch(() => setBarangays([])); }, []);

  if (!showAuthModal) return null;

  const switchMode = (next: typeof mode) => {
    setFormError('');
    if (next === 'forgot') {
      // Require the citizen to type the address fresh rather than silently
      // reusing whatever is sitting in the Sign In email field — those two
      // fields have no reason to agree, and a stale/mistyped login email
      // was exactly what caused a prior reset request to go nowhere.
      setEmail('');
      setForgotStep('email');
    }
    setMode(next);
  };

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleSubmit = async () => {
    setFormError('');
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!agreeTerms) { setFormError('Please agree to the Terms and Conditions.'); return; }
        if (email !== confirmEmail) { setFormError('Email addresses do not match.'); return; }
        if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }
        const policyError = validatePassword(password);
        if (policyError) { setFormError(policyError); return; }
        if (!birthYear || !birthMonth || !birthDay) { setFormError('Please complete your birth date.'); return; }
        const pad = (v: string) => v.padStart(2, '0');
        const birthDate = `${birthYear}-${pad(birthMonth)}-${pad(birthDay)}`;
        // The Month/Day/Year selects can assemble a calendar-invalid date (e.g.
        // 31 February) that Date silently rolls forward into March — catch that
        // with a round-trip check before it ever reaches mapSignupToProfileParams.
        const roundTripsClean = new Date(birthDate).toISOString().slice(0, 10) === birthDate;
        const dateProblem =
          birthDateError(birthDate, { minAgeYears: MIN_ACCOUNT_AGE_YEARS }) ??
          (roundTripsClean ? null : 'Please enter a valid date of birth.');
        if (dateProblem) { setFormError(dateProblem); return; }
        const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
        await signup({
          fullName, email, password,
          firstName, lastName, middleName, suffix,
          birthDate,
          genderCode: sex === 'Male' ? 'male' : sex === 'Female' ? 'female' : '',
          mobile,
          barangayCode: barangay,
          street, houseNo,
          occupation: workingInLucena === 'yes' ? occupation : '',
          worksInLucena: workingInLucena === 'yes',
          agreedToTerms: agreeTerms,
        });
      }
      setEmail(''); setPassword('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (resetSending) return;
    setFormError('');
    if (!email) { setFormError('Please enter your email address.'); return; }
    setResetSending(true);
    try {
      await authService.sendPasswordReset(email);
      setForgotStep('sent');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setResetSending(false);
    }
  };

  const overlayClass = 'fixed inset-0 bg-black/40 flex items-center justify-center z-[2000] animate-[fadeIn_0.2s_ease]';
  const modalClass = 'bg-white border border-[#DDDDDD] rounded max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto shadow-[0_4px_20px_rgba(0,0,0,0.15)]';
  const inputClass = 'w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)] placeholder:text-dark-gray';
  const labelClass = 'block text-sm font-semibold text-text-dark';

  if (mode === 'forgot') {
    return (
      <ModalShell labelledBy={headingId} onClose={closeAuthModal} panelClassName={modalClass} panelStyle={{ padding: 40, position: 'relative' }}>
        <ModalCloseButton onClose={closeAuthModal} />
        <h2 id={headingId} className="text-[28px] font-bold text-lucena-blue" style={{ marginBottom: 24 }}>
          {forgotStep === 'email' && 'Reset Password'}
          {forgotStep === 'sent' && 'Check Your Email'}
        </h2>

        {forgotStep === 'email' && (
          /* A real <form>, so Enter submits. Every form in this app used to be
             a div of inputs with an onClick button, which silently broke the
             single most common way people submit a one-field form. */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleForgotPassword();
            }}
          >
            <p className="text-sm text-dark-gray leading-relaxed" style={{ marginBottom: 24 }}>Enter your email address and we&apos;ll send you a link to reset your password.</p>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor={fid('forgot-email')} className={labelClass} style={{ display: 'block', marginBottom: 8 }}>Email Address</label>
              <input
                id={fid('forgot-email')}
                name="email"
                autoFocus
                required
                autoComplete="email"
                aria-describedby={formError ? errorId : undefined}
                aria-invalid={formError ? true : undefined}
                className={inputClass}
                style={{ padding: '12px 14px' }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            {formError && <p id={errorId} role="alert" style={{ fontSize: 13, color: '#C62828', marginBottom: 12 }}>{formError}</p>}
            <Button type="submit" variant="primary" loading={resetSending} disabled={resetSending} className="w-full" style={{ marginBottom: 12 }}>Send Reset Link</Button>
            <Button type="button" variant="ghost" onClick={() => switchMode('login')} className="w-full text-lucena-blue">Back to Sign In</Button>
          </form>
        )}

        {forgotStep === 'sent' && (
          <>
            <p className="text-sm text-dark-gray leading-relaxed" style={{ marginBottom: 24 }}>
              If an account exists for <strong>{email}</strong>, a password-reset link is on its way.
              Open it to choose a new password. Open the link on this same device and browser.
            </p>
            <Button type="button" variant="ghost" onClick={() => switchMode('login')} className="w-full text-lucena-blue">Back to Sign In</Button>
          </>
        )}
      </ModalShell>
    );
  }

  if (mode === 'login') {
    return (
      <ModalShell labelledBy={headingId} onClose={closeAuthModal} panelClassName={modalClass} panelStyle={{ padding: 40, position: 'relative' }}>
        <ModalCloseButton onClose={closeAuthModal} />
        <h2 id={headingId} className="text-[26px] font-bold text-lucena-blue" style={{ marginBottom: 24 }}>Sign In</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <label htmlFor={fid('login-email')} className={labelClass} style={{ display: 'block', marginBottom: 8 }}>Email</label>
            <input
              id={fid('login-email')}
              name="email"
              required
              autoComplete="email"
              aria-describedby={formError ? errorId : undefined}
              aria-invalid={formError ? true : undefined}
              className={inputClass}
              style={{ padding: '12px 14px' }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor={fid('login-password')} className={labelClass} style={{ display: 'block', marginBottom: 8 }}>Password</label>
            <input
              id={fid('login-password')}
              name="password"
              required
              autoComplete="current-password"
              aria-describedby={formError ? errorId : undefined}
              aria-invalid={formError ? true : undefined}
              className={inputClass}
              style={{ padding: '12px 14px' }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="button" variant="ghost" onClick={() => switchMode('forgot')} className="w-full text-lucena-blue text-sm" style={{ paddingTop: 8, paddingBottom: 8, marginBottom: 12 }}>Forgot Password?</Button>
          {formError && <p id={errorId} role="alert" style={{ fontSize: 13, color: '#C62828', marginBottom: 12 }}>{formError}</p>}
          <Button type="submit" variant="primary" loading={isSubmitting} className="w-full" style={{ marginBottom: 16 }}>Sign In</Button>
          <Button type="button" variant="ghost" onClick={() => switchMode('signup')} className="w-full text-lucena-blue">Don&apos;t have an account? Sign up</Button>
        </form>
      </ModalShell>
    );
  }

  // Sign Up
  const signupInputClass = 'w-full bg-white border border-[#CDD2DB] rounded-[3px] text-sm text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)] placeholder:text-[#757575]';
  const signupInputStyle = { padding: '9px 11px' };
  const signupLabelClass = 'block text-xs font-semibold text-[#444]';
  const signupLabelStyle = { display: 'block' as const, marginBottom: 5 };

  return (
    <ModalShell
      labelledBy={headingId}
      onClose={closeAuthModal}
      panelClassName="bg-white border border-[#DDDDDD] rounded max-w-[760px] w-[90%] max-h-[90vh] overflow-y-auto shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
      panelStyle={{ padding: 0, position: 'relative' }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div data-on-dark className="bg-lucena-blue rounded-t text-center" style={{ paddingLeft: 36, paddingRight: 36, paddingTop: 28, paddingBottom: 28, position: 'relative' }}>
          <ModalCloseButton onClose={closeAuthModal} />
          <h2 id={headingId} className="text-lg font-bold text-white tracking-[0.06em] uppercase" style={{ margin: 0 }}>Create New Lucena City E-Services Account</h2>
          <p className="text-sm text-white/75" style={{ marginTop: 4 }}>All fields marked with * are required</p>
        </div>

        <div style={{ paddingLeft: 36, paddingRight: 36, paddingTop: 28, paddingBottom: 28 }}>

          {/* Personal Information */}
          <div className="bg-[#F8F9FB] border border-[#E2E6ED] rounded" style={{ padding: 20, marginBottom: 16 }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-lucena-blue border-b border-[#DDE2EA]" style={{ marginBottom: 16, paddingBottom: 8 }}>Personal Information</div>
            {/* auto-fit grid rather than four fixed calc(25% - 9px) columns,
                which overflowed below ~375px — the width most citizens here
                actually browse at. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
              {[
                { key: 'first-name', label: 'First Name', req: true, value: firstName, set: setFirstName, placeholder: 'Enter first name', autoComplete: 'given-name' },
                { key: 'last-name', label: 'Last Name', req: true, value: lastName, set: setLastName, placeholder: 'Enter last name', autoComplete: 'family-name' },
                { key: 'middle-name', label: 'Middle Name', req: false, value: middleName, set: setMiddleName, placeholder: 'Enter middle name', autoComplete: 'additional-name' },
              ].map(f => (
                <div key={f.label}>
                  <label htmlFor={fid(f.key)} className={signupLabelClass} style={signupLabelStyle}>{f.label} {f.req && <span className="text-lucena-error ml-0.5">*</span>}</label>
                  <input id={fid(f.key)} name={f.key} required={f.req} aria-required={f.req || undefined} autoComplete={f.autoComplete} className={signupInputClass} style={signupInputStyle} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} maxLength={LIMITS.name} />
                </div>
              ))}
              <div>
                <label htmlFor={fid('suffix')} className={signupLabelClass} style={signupLabelStyle}>Suffix <span className="font-normal text-dark-gray text-[11px]">(Optional)</span></label>
                <select id={fid('suffix')} name="suffix" autoComplete="honorific-suffix" className={signupInputClass} style={signupInputStyle} value={suffix} onChange={(e) => setSuffix(e.target.value)}>
                  <option value=""></option>
                  {['Jr.','Sr.','II','III','IV'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                {/* Three selects for one value, so a fieldset/legend names the
                    group and each control carries its own visually-hidden
                    label. A single <label> here would have named only the first
                    select and left "Day" and "Year" anonymous. */}
                <fieldset style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
                  <legend className={signupLabelClass} style={{ ...signupLabelStyle, padding: 0 }}>Birth Date <span className="text-lucena-error ml-0.5">*</span></legend>
                  <div className="flex" style={{ gap: 8 }}>
                    <label htmlFor={fid('birth-month')} className="sr-only">Birth month</label>
                    <select id={fid('birth-month')} name="birth-month" required aria-required="true" className={`${signupInputClass} flex-[2]`} style={signupInputStyle} value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
                      <option value="">Month</option>
                      {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <label htmlFor={fid('birth-day')} className="sr-only">Birth day</label>
                    <select id={fid('birth-day')} name="birth-day" required aria-required="true" className={`${signupInputClass} flex-1`} style={signupInputStyle} value={birthDay} onChange={(e) => setBirthDay(e.target.value)}>
                      <option value="">Day</option>
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <label htmlFor={fid('birth-year')} className="sr-only">Birth year</label>
                    <select id={fid('birth-year')} name="birth-year" required aria-required="true" className={`${signupInputClass}`} style={{ ...signupInputStyle, flex: '1.5' }} value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
                      <option value="">Year</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </fieldset>
              </div>
              <div>
                <label htmlFor={fid('sex')} className={signupLabelClass} style={signupLabelStyle}>Sex <span className="text-lucena-error ml-0.5">*</span></label>
                <select id={fid('sex')} name="sex" required aria-required="true" className={signupInputClass} style={signupInputStyle} value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-[#F8F9FB] border border-[#E2E6ED] rounded" style={{ padding: 20, marginBottom: 16 }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-lucena-blue border-b border-[#DDE2EA]" style={{ marginBottom: 16, paddingBottom: 8 }}>Contact Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label htmlFor={fid('email')} className={signupLabelClass} style={signupLabelStyle}>Email Address <span className="text-lucena-error ml-0.5">*</span></label>
                <input id={fid('email')} name="email" required aria-required="true" autoComplete="email" className={signupInputClass} style={signupInputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email address" maxLength={LIMITS.email} />
              </div>
              <div>
                {/* Deliberately autoComplete="off": a password manager filling
                    both email fields defeats the point of asking twice. */}
                <label htmlFor={fid('confirm-email')} className={signupLabelClass} style={signupLabelStyle}>Confirm Email Address <span className="text-lucena-error ml-0.5">*</span></label>
                <input id={fid('confirm-email')} name="confirm-email" required aria-required="true" autoComplete="off" className={signupInputClass} style={signupInputStyle} type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="Re-enter email address" maxLength={LIMITS.email} />
              </div>
            </div>
            <div>
              <label htmlFor={fid('mobile')} className={signupLabelClass} style={signupLabelStyle}>Mobile Number <span className="text-lucena-error ml-0.5">*</span></label>
              <PhoneInput id={fid('mobile')} required autoComplete="tel-national" className={signupInputClass} inputStyle={signupInputStyle} value={mobile} onChange={setMobile} />
              <p className="text-[11px] text-dark-gray" style={{ marginTop: 4, lineHeight: 1.5 }}>
                Responders may call this number when handling an incident you report.
              </p>
            </div>
          </div>

          {/* Address */}
          <div className="bg-[#F8F9FB] border border-[#E2E6ED] rounded" style={{ padding: 20, marginBottom: 16 }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-lucena-blue border-b border-[#DDE2EA]" style={{ marginBottom: 16, paddingBottom: 8 }}>Address</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { key: 'house-no', label: 'House #', req: false, value: houseNo, set: setHouseNo, placeholder: 'Enter house number', autoComplete: 'address-line2' },
                { key: 'street', label: 'Street', req: true, value: street, set: setStreet, placeholder: 'Enter street name', autoComplete: 'address-line1' },
              ].map(f => (
                <div key={f.label}>
                  <label htmlFor={fid(f.key)} className={signupLabelClass} style={signupLabelStyle}>{f.label} {f.req ? <span className="text-lucena-error ml-0.5">*</span> : <span className="font-normal text-dark-gray text-[11px]">(Optional)</span>}</label>
                  <input id={fid(f.key)} name={f.key} required={f.req} aria-required={f.req || undefined} autoComplete={f.autoComplete} className={signupInputClass} style={signupInputStyle} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} maxLength={LIMITS.address} />
                </div>
              ))}
              <div>
                <label htmlFor={fid('barangay')} className={signupLabelClass} style={signupLabelStyle}>Barangay <span className="text-lucena-error ml-0.5">*</span></label>
                <select id={fid('barangay')} name="barangay" required aria-required="true" autoComplete="address-level3" className={signupInputClass} style={signupInputStyle} value={barangay} onChange={(e) => setBarangay(e.target.value)}>
                  <option value="">Select Barangay</option>
                  {barangays.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Employment */}
          <div className="bg-[#F8F9FB] border border-[#E2E6ED] rounded" style={{ padding: 20, marginBottom: 16 }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-lucena-blue border-b border-[#DDE2EA]" style={{ marginBottom: 16, paddingBottom: 8 }}>Employment</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <fieldset style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
                <legend className={signupLabelClass} style={{ ...signupLabelStyle, padding: 0 }}>Are you working in Lucena City? <span className="text-lucena-error ml-0.5">*</span></legend>
                <div className="flex items-center" style={{ gap: 20, paddingTop: 9, paddingBottom: 9 }}>
                  {['yes','no'].map(v => (
                    <label key={v} className="flex items-center text-sm text-text-dark cursor-pointer" style={{ gap: 6 }}>
                      <input type="radio" name="workingInLucena" value={v} checked={workingInLucena === v} onChange={() => setWorkingInLucena(v)} className="accent-lucena-blue w-[15px] h-[15px]" />
                      {v === 'yes' ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
                </fieldset>
              </div>
              <div>
                <label htmlFor={fid('occupation')} className={signupLabelClass} style={signupLabelStyle}>Occupation <span className="font-normal text-dark-gray text-[11px]">(Optional)</span></label>
                <input id={fid('occupation')} name="occupation" autoComplete="organization-title" className={signupInputClass} value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Enter occupation" disabled={workingInLucena === 'no'} style={{ ...signupInputStyle, background: workingInLucena === 'no' ? '#F0F0F0' : undefined, color: workingInLucena === 'no' ? '#767676' : undefined }} maxLength={LIMITS.shortText} />
              </div>
            </div>
          </div>

          {/* Account Security */}
          <div className="bg-[#F8F9FB] border border-[#E2E6ED] rounded" style={{ padding: 20, marginBottom: 16 }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-lucena-blue border-b border-[#DDE2EA]" style={{ marginBottom: 16, paddingBottom: 8 }}>Account Security</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label htmlFor={fid('password')} className={signupLabelClass} style={signupLabelStyle}>Password <span className="text-lucena-error ml-0.5">*</span></label>
                <div className="relative">
                  <input id={fid('password')} name="new-password" required aria-required="true" autoComplete="new-password" aria-describedby={fid('password-rules')} className={signupInputClass} style={signupInputStyle} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create password (min. 8 chars)" />
                  {/* type="button": inside a real <form> a bare <button> is a
                      submit button, so toggling visibility would have submitted
                      the signup form. */}
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer text-[15px] text-dark-gray"><span aria-hidden="true">{showPassword ? '🙈' : '👁'}</span></button>
                </div>
                <p id={fid('password-rules')} className="text-[11px] text-dark-gray" style={{ marginTop: 4, lineHeight: 1.5 }}>{PASSWORD_RULES_TEXT}</p>
              </div>
              <div>
                <label htmlFor={fid('confirm-password')} className={signupLabelClass} style={signupLabelStyle}>Confirm Password <span className="text-lucena-error ml-0.5">*</span></label>
                <input id={fid('confirm-password')} name="confirm-password" required aria-required="true" autoComplete="new-password" className={signupInputClass} style={signupInputStyle} type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
              </div>
            </div>
          </div>

        </div>

        <div className="flex flex-col" style={{ paddingLeft: 36, paddingRight: 36, paddingBottom: 28, gap: 10 }}>
          <label className="flex items-start text-xs text-dark-gray leading-[1.5] cursor-pointer" style={{ gap: 10, marginBottom: 4 }}>
            <input id={fid('agree-terms')} name="agree-terms" type="checkbox" required aria-required="true" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="accent-lucena-blue mt-0.5 flex-shrink-0" />
            <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-lucena-blue underline cursor-pointer">Terms and Conditions</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-lucena-blue underline cursor-pointer">Privacy Policy</a> of the Lucena City E-Services Portal.</span>
          </label>
          {formError && <p id={errorId} role="alert" style={{ fontSize: 13, color: '#C62828', marginBottom: 12 }}>{formError}</p>}
          <Button type="submit" variant="primary" loading={isSubmitting} className="w-full text-[15px]" style={{ paddingTop: 14, paddingBottom: 14 }}>Create Account</Button>
          <Button type="button" variant="ghost" onClick={() => switchMode('login')} className="w-full text-lucena-blue text-sm">Already have an account? Sign In</Button>
        </div>
      </form>
    </ModalShell>
  );
}
