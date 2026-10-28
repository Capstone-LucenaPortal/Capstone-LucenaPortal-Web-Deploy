'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import ProtectedRoute from '@/portals/citizen/features/auth/components/protected-route';
import DigitalCard from '@/portals/citizen/features/yellow-card/components/digital-card';
import PrivacyAndData, { AnonymisedNotice } from '@/portals/citizen/features/profile/components/privacy-and-data';
import { PhoneInput } from '@/portals/citizen/components/ui/phone-input';
import type { MyProfile } from '@/portals/citizen/features/profile/types';
import { profileService } from '@/portals/citizen/features/profile/lib/profile';
import { catalogService, type CatalogOption } from '@/portals/citizen/lib/supabase/catalogs';
import type { MyYellowCardApplication, MyYellowCard } from '@/portals/citizen/features/yellow-card/types';
import { yellowCardService } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import { computeYellowCardStatus } from '@/portals/citizen/features/dashboard/lib/status';
import { authService, AuthError } from '@/portals/citizen/features/auth/lib/auth';
import { PASSWORD_RULES_TEXT } from '@/portals/citizen/features/auth/lib/password-policy';
import { LIMITS } from '@/portals/citizen/lib/validation';
import { profileTabFromQuery, type ProfileTab } from '@/portals/citizen/features/profile/lib/tabs';
import { formatManilaDate } from '@/shared/dates/manila';

const emptyFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  houseNo: '',
  street: '',
  barangayCode: '',
  barangayName: '',
  dateOfBirth: '',
  genderCode: '',
  genderLabel: '',
};

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  // Read once, as the initial value: the citizen may switch tabs afterwards and
  // deriving `activeTab` from the URL would snap them back on every render.
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => profileTabFromQuery(searchParams.get('tab')));

  /** Switch tabs and keep `?tab=` in step, so a reload or a shared link lands on
   *  the tab being looked at rather than the one the page was opened with.
   *  `replace`, not `push`: tabbing around should not fill the back button. */
  const selectTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    router.replace(`/profile?tab=${tab}`, { scroll: false });
  };
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [barangays, setBarangays] = useState<CatalogOption[]>([]);
  const [genders, setGenders] = useState<CatalogOption[]>([]);
  const [formData, setFormData] = useState(emptyFormData);
  const [applications, setApplications] = useState<MyYellowCardApplication[]>([]);
  const [cards, setCards] = useState<MyYellowCard[]>([]);

  const applyProfile = (p: MyProfile) => {
    setProfile(p);
    setFormData({
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      email: p.email ?? user?.email ?? '',
      phone: p.mobile ?? '',
      houseNo: p.house_no ?? '',
      street: p.street ?? '',
      barangayCode: p.barangay_code ?? '',
      barangayName: p.barangay_name ?? '',
      dateOfBirth: p.birth_date ?? '',
      genderCode: p.gender_code ?? '',
      genderLabel: p.gender_label ?? '',
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const [p, b, g, a, c] = await Promise.all([
          profileService.getMyProfile(),
          catalogService.getBarangays().catch(() => []),
          catalogService.getGenders().catch(() => []),
          yellowCardService.getMyApplications().catch(() => []),
          yellowCardService.getMyCards().catch(() => []),
        ]);
        setBarangays(b);
        setGenders(g);
        setApplications(a);
        setCards(c);
        if (p) applyProfile(p);
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : 'Could not load your profile.');
      } finally {
        setProfileLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleInputChange = (field: keyof typeof emptyFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await profileService.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: profile?.middle_name ?? undefined,
        suffix: profile?.suffix ?? undefined,
        birthDate: formData.dateOfBirth,
        genderCode: formData.genderCode,
        mobile: formData.phone,
        barangayCode: formData.barangayCode,
        street: formData.street,
        houseNo: formData.houseNo,
        occupation: profile?.occupation ?? undefined,
        worksInLucena: profile?.works_in_lucena ?? undefined,
      });
      const refreshed = await profileService.getMyProfile();
      if (refreshed) applyProfile(refreshed);
      setEditMode(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const address = [formData.houseNo, formData.street, formData.barangayName].filter(Boolean).join(', ');

  const activeCard = cards.find((c) => c.status === 'active') ?? null;
  // The most recent non-active card, used only when there is no active one.
  // Cards arrive newest-first from the service layer.
  const nonActiveCard = activeCard
    ? null
    : cards.find((c) => c.status === 'revoked' || c.status === 'superseded') ?? null;
  const latestApplication = applications[0] ?? null;
  const ycStatus = computeYellowCardStatus(applications, cards);

  const handleChangePassword = async () => {
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await authService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordSuccess(true);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      setPasswordError(
        err instanceof AuthError ? err.message : 'Could not update your password right now. Please try again later.',
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <section style={{ padding: '48px clamp(20px, 5vw, 48px) 80px', maxWidth: 1000, margin: '0 auto' }}>
      <button className="bg-transparent border-none text-text-dark cursor-pointer text-[15px] font-medium rounded transition-all hover:bg-medium-gray hover:text-lucena-blue" onClick={() => router.push('/')} style={{ marginBottom: 32, padding: '8px 0', fontWeight: 600 }}>← Back to Home</button>
      <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 32 }}>Account Management</h1>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #DDDDDD', marginBottom: 32 }}>
        <button onClick={() => selectTab('account')} style={{ padding: '12px 16px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'account' ? '3px solid #003DA5' : '3px solid transparent', color: activeTab === 'account' ? '#003DA5' : '#666666', fontWeight: activeTab === 'account' ? 600 : 500, cursor: 'pointer', background: 'none', fontSize: 14 }}>
          Account Details
        </button>
        <button onClick={() => selectTab('security')} style={{ padding: '12px 16px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'security' ? '3px solid #003DA5' : '3px solid transparent', color: activeTab === 'security' ? '#003DA5' : '#666666', fontWeight: activeTab === 'security' ? 600 : 500, cursor: 'pointer', background: 'none', fontSize: 14 }}>
          Security &amp; Password
        </button>
        <button onClick={() => selectTab('yellowcard')} style={{ padding: '12px 16px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'yellowcard' ? '3px solid #003DA5' : '3px solid transparent', color: activeTab === 'yellowcard' ? '#003DA5' : '#666666', fontWeight: activeTab === 'yellowcard' ? 600 : 500, cursor: 'pointer', background: 'none', fontSize: 14 }}>
          Yellow Card Details
        </button>
        <button onClick={() => selectTab('privacy')} style={{ padding: '12px 16px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: activeTab === 'privacy' ? '3px solid #003DA5' : '3px solid transparent', color: activeTab === 'privacy' ? '#003DA5' : '#666666', fontWeight: activeTab === 'privacy' ? 600 : 500, cursor: 'pointer', background: 'none', fontSize: 14 }}>
          Privacy &amp; Data
        </button>
      </div>

      {activeTab === 'privacy' && <PrivacyAndData profile={profile} />}

      {/* Account Details Tab.
          An anonymised profile short-circuits to a tombstone: the form used to
          render normally and fail only when the citizen pressed Save, which
          reads as a broken portal rather than a completed erasure. */}
      {activeTab === 'account' && profile?.anonymised_at && (
        <AnonymisedNotice anonymisedAt={profile.anonymised_at} />
      )}
      {activeTab === 'account' && !profile?.anonymised_at && (
        <div>
          {profileLoading ? (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
              <p style={{ fontSize: 14, color: '#666666' }}>Loading your profile…</p>
            </div>
          ) : profileError ? (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
              <p style={{ fontSize: 14, color: '#C62828' }}>{profileError}</p>
            </div>
          ) : !editMode ? (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>Personal Information</h2>
                <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>First Name</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{formData.firstName || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>Last Name</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{formData.lastName || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>Email Address</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{formData.email || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>Phone Number</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{formData.phone || '—'}</p>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>Address</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{address || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>Date of Birth</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{formData.dateOfBirth || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>Gender</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{formData.genderLabel || '—'}</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setEditMode(true)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#003DA5', color: 'white', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Edit Profile</button>
            </div>
          ) : (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>Edit Personal Information</h2>
              {saveError && <p style={{ fontSize: 13, color: '#C62828', marginBottom: 16 }}>{saveError}</p>}
              <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="firstName" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>First Name</label>
                  <input id="firstName" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} maxLength={LIMITS.name} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="lastName" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Last Name</label>
                  <input id="lastName" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type="text" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} maxLength={LIMITS.name} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="editEmail" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Email Address</label>
                  <input id="editEmail" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px', opacity: 0.7 }} type="email" value={formData.email} disabled />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="phone" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Phone Number</label>
                  <PhoneInput
                    id="phone"
                    className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]"
                    inputStyle={{ padding: '12px 16px' }}
                    value={formData.phone}
                    onChange={(v) => handleInputChange('phone', v)}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="houseNo" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>House #</label>
                  <input id="houseNo" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type="text" value={formData.houseNo} onChange={(e) => handleInputChange('houseNo', e.target.value)} maxLength={LIMITS.address} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="street" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Street</label>
                  <input id="street" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type="text" value={formData.street} onChange={(e) => handleInputChange('street', e.target.value)} maxLength={LIMITS.address} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="barangayCode" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Barangay</label>
                  <select id="barangayCode" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} value={formData.barangayCode} onChange={(e) => handleInputChange('barangayCode', e.target.value)}>
                    <option value="">Select Barangay</option>
                    {barangays.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="dateOfBirth" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Date of Birth</label>
                  <input id="dateOfBirth" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} max={new Date().toISOString().slice(0, 10)} min="1906-01-01" />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="gender" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Gender</label>
                  <select id="gender" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} value={formData.genderCode} onChange={(e) => handleInputChange('genderCode', e.target.value)}>
                    <option value="">Select Sex</option>
                    {genders.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button disabled={saving} className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]" onClick={handleSaveProfile} style={{ padding: '12px 28px', background: '#003DA5', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save Changes'}</button>
                <button disabled={saving} className="bg-transparent cursor-pointer text-[15px] font-medium rounded transition-all hover:bg-medium-gray" onClick={() => { setSaveError(''); setEditMode(false); if (profile) applyProfile(profile); }} style={{ border: '2px solid #003DA5', color: '#003DA5', padding: '12px 28px' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security & Password Tab */}
      {activeTab === 'security' && (
        <div>
          {passwordSuccess && (
            <div style={{ background: '#D1FAE5', color: '#047857', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14, fontWeight: 500 }}>
              ✓ Password changed successfully! Your new password is now active.
            </div>
          )}
          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>Change Password</h2>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="currentPassword" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Current Password</label>
              <input id="currentPassword" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type="password" placeholder="Enter your current password" value={passwordData.currentPassword} onChange={(e) => handlePasswordChange('currentPassword', e.target.value)} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label htmlFor="newPassword" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input id="newPassword" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type={showPasswords.new ? 'text' : 'password'} placeholder="Enter your new password" value={passwordData.newPassword} onChange={(e) => handlePasswordChange('newPassword', e.target.value)} />
                <button aria-label={showPasswords.new ? 'Hide password' : 'Show password'} onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                  {showPasswords.new ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#666666', marginBottom: 20 }}>{PASSWORD_RULES_TEXT}</p>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input id="confirmPassword" className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-text-dark font-sans transition-all focus:outline-none focus:border-lucena-blue focus:shadow-[0_0_0_3px_rgba(0,61,165,0.1)]" style={{ padding: '12px 16px' }} type={showPasswords.confirm ? 'text' : 'password'} placeholder="Re-enter your new password" value={passwordData.confirmPassword} onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)} />
                <button aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'} onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                  {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {passwordError && <p style={{ fontSize: 13, color: '#C62828', marginBottom: 16 }}>{passwordError}</p>}

            <button disabled={passwordSaving} className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]" onClick={handleChangePassword} style={{ padding: '12px 28px', background: '#003DA5', opacity: passwordSaving ? 0.7 : 1 }}>{passwordSaving ? 'Updating…' : 'Update Password'}</button>
          </div>
        </div>
      )}

      {/* Yellow Card Details Tab */}
      {activeTab === 'yellowcard' && (
        <div>
          {profileLoading ? (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
              <p style={{ fontSize: 14, color: '#666666' }}>Loading your Yellow Card details…</p>
            </div>
          ) : applications.length === 0 && !activeCard ? (
            <div style={{ background: 'white', border: '1px solid #DDDDDD', borderRadius: 8, padding: '64px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 16px' }}>
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>
              </svg>
              <p style={{ fontSize: 15, color: '#666666', marginBottom: 24 }}>You haven&apos;t applied for a Yellow Card yet.</p>
              <button
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FDB913', color: 'black', border: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => router.push('/yellow-card')}
              >Apply Now</button>
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', margin: 0 }}>Yellow Card Application Status</h2>
                  <span style={{ background: `${ycStatus.color}22`, color: ycStatus.color, padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{ycStatus.icon} {ycStatus.label}</span>
                </div>

                <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #DDDDDD' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>{activeCard ? 'Card Number' : 'Application Number'}</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{ycStatus.ref ?? '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>{ycStatus.dateLabel || 'Date'}</p>
                    <p style={{ fontSize: 15, color: '#333333' }}>{formatManilaDate(ycStatus.date)}</p>
                  </div>
                </div>

                {ycStatus.reason && (
                  <p style={{ fontSize: 13, color: '#666666', marginBottom: 24, padding: '12px 16px', background: '#FFF7ED', borderRadius: 6 }}>{ycStatus.reason}</p>
                )}

                <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 12, textTransform: 'uppercase' }}>Card Details</p>
                    <div style={{ fontSize: 13, color: '#333333', lineHeight: 1.8 }}>
                      <p><strong>Cardholder:</strong> {activeCard?.holder_name ?? (latestApplication ? `${latestApplication.first_name} ${latestApplication.last_name}` : user?.name) ?? '—'}</p>
                      <p><strong>Barangay:</strong> {activeCard?.barangay_name ?? latestApplication?.barangay_name ?? '—'}</p>
                      {activeCard ? (
                        <p><strong>Expires:</strong> {activeCard.expires_at ? formatManilaDate(activeCard.expires_at) : 'No Expiry'}</p>
                      ) : (
                        <p><strong>Documents Uploaded:</strong> {latestApplication?.document_count ?? 0}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 12, textTransform: 'uppercase' }}>Benefits</p>
                    <ul style={{ fontSize: 13, color: '#333333', lineHeight: 1.8, listStyle: 'none', paddingLeft: 0 }}>
                      <li>✓ Citizen Discount Programs</li>
                      <li>✓ Priority in City Services</li>
                      <li>✓ Access to Public Events</li>
                      <li>✓ City ID Verification</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>Digital Yellow Card</h3>

                <DigitalCard
                  activeCard={activeCard}
                  nonActiveCard={nonActiveCard}
                  application={activeCard ? applications.find((a) => a.id === activeCard.application_id) : null}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Logout Button */}
      <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid #DDDDDD', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]" onClick={() => { logout(); router.push('/'); }} style={{ padding: '12px 28px', background: '#C62828' }}>Logout</button>
      </div>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      {/* `useSearchParams` requires a Suspense boundary in the App Router;
          without one the whole route opts out of static rendering. */}
      <Suspense fallback={<section style={{ padding: 48 }}><p>Loading…</p></section>}>
        <ProfileContent />
      </Suspense>
    </ProtectedRoute>
  );
}
