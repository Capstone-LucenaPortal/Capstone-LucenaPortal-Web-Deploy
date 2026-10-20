'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import type { PhotoUploadProgress } from '@/portals/citizen/features/incidents/types';
import { submitIncident, getMyIncidents, uploadIncidentPhoto, IncidentSubmitError, IncidentPhotoError } from '@/portals/citizen/features/incidents/lib/incidents';
import {
  catalogService,
  type CatalogOption,
  type IncidentTypeDetail,
  type IncidentConfig,
  type SiteInfo,
  type SiteInfoEntry,
} from '@/portals/citizen/lib/supabase/catalogs';
import ProtectedRoute from '@/portals/citizen/features/auth/components/protected-route';
import { ReceiptLink } from '@/portals/citizen/features/receipts/components/receipt-link';
import { LIMITS } from '@/portals/citizen/lib/validation';
import { Button } from '@/portals/citizen/components/ui/button';
import { validateUploadFile, MAX_UPLOAD_BYTES } from '@/portals/citizen/lib/storage/file-validation';

interface IncidentFormData {
  incidentTypeCode: string;
  location: string;
  barangayCode: string;
  description: string;
  isAnonymous: boolean;
  photoFile: File | null;
  photoPreview: string | null;
}

const EMPTY_FORM: IncidentFormData = {
  incidentTypeCode: '',
  location: '',
  barangayCode: '',
  description: '',
  isAnonymous: false,
  photoFile: null,
  photoPreview: null,
};

/** Where the photo has got to, once the report itself is filed. */
type PhotoStatus = 'none' | 'uploading' | 'verified' | 'failed';

/** `incidents.incident_level` enum -> citizen-facing copy and dot colour. */
const LEVEL_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical Priority', color: '#EF4444' },
  high: { label: 'High Priority', color: '#F97316' },
  medium: { label: 'Medium Priority', color: '#EAB308' },
  low: { label: 'Low Priority', color: '#10B981' },
};

/** SLA hours -> citizen-facing copy ("8 hours", "3 days"). */
function formatSla(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// submit_incident counts `status <> 'closed'` against max_active_reports_per_citizen.
// Mirrored here only so the form can warn before the round trip — the RPC is the
// real gate.
const isActiveIncident = (status: string) => status !== 'closed';

function IncidentContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState<IncidentFormData>(EMPTY_FORM);
  const [incidentTypes, setIncidentTypes] = useState<IncidentTypeDetail[]>([]);
  const [barangays, setBarangays] = useState<CatalogOption[]>([]);
  const [departments, setDepartments] = useState<CatalogOption[]>([]);
  const [config, setConfig] = useState<IncidentConfig | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [activeReports, setActiveReports] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>('none');
  const [photoError, setPhotoError] = useState('');
  // Client-side selection validation (size/type/magic bytes), separate from
  // photoError above — which reports failures of the actual upload, after
  // the report is filed.
  const [photoSelectError, setPhotoSelectError] = useState('');
  // F1: what a failed upload had already reserved/landed, so Retry can resume
  // the step that failed instead of re-reserving (which burns the per-cycle cap).
  const [photoProgress, setPhotoProgress] = useState<PhotoUploadProgress | undefined>(undefined);
  // Emergency numbers and the trunkline are LGU-editable config, the same rows
  // the homepage renders. Never hardcode one here — an edit in Super Staff has
  // to move every surface that quotes it, not just /.
  const [hotlines, setHotlines] = useState<SiteInfoEntry[]>([]);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  // F3: bumped on every new submission and on "Submit Another Report", so a
  // stale in-flight upload from a previous report can recognise it is stale
  // and skip its state writes instead of leaking onto the next report.
  const uploadGenerationRef = useRef(0);

  void user;

  useEffect(() => {
    (async () => {
      const [types, brgys, depts, cfg, lines, info, mine] = await Promise.all([
        catalogService.getIncidentTypeDetails().catch(() => []),
        catalogService.getBarangays().catch(() => []),
        catalogService.getDepartments().catch(() => []),
        catalogService.getIncidentConfig().catch(() => null),
        catalogService.getEmergencyHotlines().catch(() => []),
        catalogService.getSiteInfo().catch(() => null),
        getMyIncidents().catch(() => []),
      ]);
      setIncidentTypes(types);
      setBarangays(brgys);
      setDepartments(depts);
      setConfig(cfg);
      setHotlines(lines);
      setSiteInfo(info);
      setActiveReports(mine.filter((i) => isActiveIncident(i.status)).length);
    })();
  }, []);

  // The list arrives in the LGU's own sort order, so the first row is the number
  // they consider primary. Picking by label instead would break on a rename.
  const primaryHotline = hotlines[0] ?? null;

  const selectedType = incidentTypes.find((t) => t.code === formData.incidentTypeCode) ?? null;
  const levelMeta = selectedType ? LEVEL_META[selectedType.base_level] : null;
  const maxActiveReports = config?.max_active_reports_per_citizen ?? null;

  // "which incident types land on which desk", built from the catalogs rather
  // than a hand-written list that drifts from incident_types.default_department_code.
  const routingSummary = departments
    .map((dept) => ({
      department: dept.label,
      types: incidentTypes
        .filter((t) => t.default_department_code === dept.code)
        .map((t) => t.label)
        .join(', '),
    }))
    .filter((row) => row.types.length > 0);

  // The confirmation replaces a long form, so without this it opens scrolled to
  // where Submit was and the heading and reference number start off-screen.
  useEffect(() => {
    if (submitted) window.scrollTo({ top: 0 });
  }, [submitted]);

  const handleInputChange = (field: keyof IncidentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: field === 'isAnonymous' ? value === 'true' : value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = await validateUploadFile(file, 'image');
    if (problem) {
      setPhotoSelectError(problem);
      return;
    }
    setPhotoSelectError('');
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      setFormData(prev => ({
        ...prev,
        photoFile: file,
        photoPreview: file.type.startsWith('image/') ? (event.target?.result as string) : null,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Runs after the report is already filed, so a failure here never costs the
  // citizen their report — only the verification, which Retry can still win back.
  //
  // `generation` is the value `uploadGenerationRef.current` held when this call
  // was started (F3): if the ref has since moved on — a new report was
  // submitted, or the citizen started another one — this call's state writes
  // are stale and are skipped rather than leaking onto whatever is on screen now.
  const runPhotoUpload = async (
    id: string,
    file: File,
    generation: number,
    progress?: PhotoUploadProgress,
  ) => {
    if (uploadGenerationRef.current !== generation) return;

    // F4: a live `submit_incident` row that somehow lacks `id` leaves nothing
    // valid to upload against — every attempt (including Retry) would fail on
    // an invalid UUID with an opaque generic message. Say so plainly instead.
    if (!id) {
      setPhotoStatus('failed');
      setPhotoProgress(undefined);
      setPhotoError('We could not attach a photo to this report right now. Please contact us if you need to add one.');
      return;
    }

    setPhotoStatus('uploading');
    setPhotoError('');
    try {
      await uploadIncidentPhoto(id, file, progress);
      if (uploadGenerationRef.current !== generation) return;
      setPhotoStatus('verified');
      setPhotoProgress(undefined);
    } catch (err) {
      if (uploadGenerationRef.current !== generation) return;
      setPhotoStatus('failed');
      setPhotoProgress(err instanceof IncidentPhotoError ? err.progress : undefined);
      setPhotoError(
        err instanceof IncidentPhotoError
          ? err.message
          : 'We could not attach your photo right now. Please try again.',
      );
    }
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    // F3: reset any leftover photo state from a previous report before this
    // submission starts, so a stale 'verified'/'failed' from report A can never
    // be visible under report B, even for the instant before B's own upload
    // (if any) begins.
    setPhotoStatus('none');
    setPhotoError('');
    setPhotoProgress(undefined);
    // Invalidate any still-in-flight upload from a previous report. Captured
    // locally so this submission's own upload knows the generation it belongs to.
    const generation = ++uploadGenerationRef.current;
    // Courtesy check only — `submit_incident`'s 23514 is the real gate, and both
    // now say the same thing. An `alert()` here was the odd one out; every other
    // failure on this form uses the inline banner.
    if (maxActiveReports != null && activeReports >= maxActiveReports) {
      setErrorMessage(
        'You have reached the maximum number of open reports. A slot frees up when a report is closed — confirming a resolved report closes it.',
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitIncident({
        incidentTypeCode: formData.incidentTypeCode,
        incidentTypeLabel: selectedType?.label ?? '',
        location: formData.location,
        barangayCode: formData.barangayCode,
        barangayLabel: barangays.find((b) => b.code === formData.barangayCode)?.label ?? '',
        description: formData.description,
        isAnonymous: formData.isAnonymous,
        hasPhoto: formData.photoFile !== null,
      });
      setTicketNumber(result.referenceNumber);
      setIncidentId(result.incidentId);
      setActiveReports((prev: number) => prev + 1);
      setSubmitted(true);
      // Deliberately not awaited: the ticket number is the news the citizen came
      // for, and a slow 5MB upload should not withhold it. runPhotoUpload itself
      // handles an empty result.incidentId (F4).
      if (formData.photoFile) void runPhotoUpload(result.incidentId, formData.photoFile, generation);
    } catch (err) {
      setErrorMessage(
        err instanceof IncidentSubmitError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 80, marginBottom: 24 }}>✓</div>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>Report Submitted Successfully!</h1>
          {/* "received", not "assigned": the report lands `open` with only a
              suggested department, and staff route it by hand (SCRUM-192). */}
          <p style={{ fontSize: 16, color: '#666666' }}>Your incident report has been received.</p>
        </div>
        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ background: '#003DA5', color: 'white', marginBottom: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Your Reference Number</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, margin: 0 }}>{ticketNumber}</h2>
              <button aria-label="Copy reference number" onClick={() => navigator.clipboard.writeText(ticketNumber)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 40, height: 40, borderRadius: 4, cursor: 'pointer', fontSize: 18 }}>📋</button>
            </div>
          </div>
          {photoStatus !== 'none' && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 24, paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {photoStatus === 'uploading' && (
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>Attaching your photo…</span>
              )}
              {photoStatus === 'verified' && (
                <span style={{ fontSize: 14, fontWeight: 600, color: '#86EFAC' }}>✓ Photo attached — your report is verified.</span>
              )}
              {photoStatus === 'failed' && (
                <>
                  <span style={{ fontSize: 14, color: '#FECACA' }}>⚠ {photoError}</span>
                  <button
                    onClick={() => {
                      // F1: resume from wherever the failed attempt got to —
                      // photoProgress carries the reservation, if one exists —
                      // rather than re-reserving and burning another cap slot.
                      if (formData.photoFile) {
                        void runPhotoUpload(incidentId, formData.photoFile, uploadGenerationRef.current, photoProgress);
                      }
                    }}
                    style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>What Happens Next?</h3>
          <div style={{ display: 'grid', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#003DA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>1</div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#333333', marginBottom: 4 }}>Review & Assignment</p>
                <p style={{ fontSize: 13, color: '#666666' }}>Your report will be reviewed and assigned to the appropriate department within 24 hours.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#003DA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>2</div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#333333', marginBottom: 4 }}>Investigation</p>
                <p style={{ fontSize: 13, color: '#666666' }}>The assigned department will investigate and assess the incident.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#003DA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>3</div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#333333', marginBottom: 4 }}>Resolution</p>
                {/* Written when `resolve_incident` notified nobody. Since DB
                    `l78` (SCRUM-180) it sends a `resolution_submitted` notice,
                    so this copy could now promise one. It is still true as it
                    stands. See the note at the top of
                    `@/features/incidents/types` before editing this. */}
                <p style={{ fontSize: 13, color: '#666666' }}>Your Dashboard shows the status as soon as the department resolves it, and asks you to confirm.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ marginBottom: 40, background: '#F5F5F5' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Important Information</h3>
          <ul style={{ fontSize: 13, color: '#333333', lineHeight: 2, listStyle: 'none', paddingLeft: 0 }}>
            <li>• Keep your reference number <strong>{ticketNumber}</strong> for tracking and reference purposes.</li>
            <li>• Check your Dashboard for the current status at any time. If your confirmation is still outstanding, a reminder appears in your portal inbox, and again once the report is closed.</li>
            <li>• Response time varies based on the urgency level and type of incident reported.</li>
            {siteInfo?.trunkline && (
              <li>• For urgent matters requiring immediate attention, please call our hotline at {siteInfo.trunkline}.</li>
            )}
          </ul>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Button variant="primary" onClick={() => router.push('/')} className="text-base font-bold" style={{ paddingTop: 14, paddingBottom: 14 }}>
            Return to Home
          </Button>
          <ReceiptLink reference={ticketNumber} variant="button" />
          <Button
            variant="ghost"
            onClick={() => {
              // F3: bump the generation so a still-in-flight upload from this
              // report can no longer write its result once we've moved on.
              uploadGenerationRef.current++;
              setFormData(EMPTY_FORM);
              setSubmitted(false);
              setIncidentId('');
              setPhotoStatus('none');
              setPhotoError('');
              setPhotoProgress(undefined);
            }}
            className="py-3.5 text-base font-bold border-2 border-[#003DA5] text-[#003DA5]"
          >
            Submit Another Report
          </Button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 24, borderTop: '1px solid #DDDDDD' }}>
          <p style={{ fontSize: 12, color: '#666666' }}>Need to track your report? Contact us at <a href="mailto:support@lucena-city.gov.ph" style={{ color: '#003DA5', textDecoration: 'none' }}>support@lucena-city.gov.ph</a></p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: '#DC2626', color: 'white', padding: 16, borderRadius: 4, marginBottom: 40, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 24, flexShrink: 0 }}>🚨</div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>FOR LIFE-THREATENING EMERGENCIES</p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>This portal is NOT for emergencies. If you are in immediate danger or witnessing an active crime/fire, call {primaryHotline && <><strong>{primaryHotline.value}</strong> or </>}your local emergency hotline immediately.</p>
        </div>
      </div>
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ background: '#DC2626', color: 'white', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Report Required</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>Incident Report</h1>
        <p style={{ fontSize: 16, color: '#666666' }}>Report road damage, broken utilities, or community disruptions directly to the right department.</p>
      </div>
      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40 }}>
        <div>
          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid #DDDDDD' }}>Submit Incident Report</h2>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="incident-type" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}><span style={{ color: '#C62828' }}>*</span> Type of Incident</label>
              <select id="incident-type" className="w-full border border-[#CCCCCC] rounded text-sm text-[#333333] outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" style={{ padding: '12px 16px', width: '100%' }} value={formData.incidentTypeCode} onChange={(e) => handleInputChange('incidentTypeCode', e.target.value)}>
                <option value="">Select incident type</option>
                {incidentTypes.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            {levelMeta && (
              <div style={{ marginBottom: 20 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}>Incident Level</span>
                <div style={{ padding: '12px 16px', border: '1px solid #CCCCCC', borderRadius: 4, background: '#F5F5F5', fontSize: 14, color: '#333333', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: levelMeta.color }}></span>
                  {levelMeta.label}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="incident-location" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}><span style={{ color: '#C62828' }}>*</span> Incident Location</label>
              <input id="incident-location" className="w-full border border-[#CCCCCC] rounded text-sm text-[#333333] outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" style={{ padding: '12px 16px', width: '100%' }} type="text" placeholder="Street name, landmark, or specific address" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} maxLength={LIMITS.address} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="incident-barangay" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}><span style={{ color: '#C62828' }}>*</span> Barangay</label>
              <select id="incident-barangay" className="w-full border border-[#CCCCCC] rounded text-sm text-[#333333] outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" style={{ padding: '12px 16px', width: '100%' }} value={formData.barangayCode} onChange={(e) => handleInputChange('barangayCode', e.target.value)}>
                <option value="">Select barangay</option>
                {barangays.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="incident-description" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}><span style={{ color: '#C62828' }}>*</span> Incident Description</label>
              <textarea id="incident-description" className="w-full border border-[#CCCCCC] rounded text-sm text-[#333333] outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" placeholder="Please provide detailed information about the incident..." style={{ padding: '12px 16px', width: '100%', minHeight: 120, fontFamily: 'Inter, sans-serif', resize: 'vertical' }} value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} maxLength={LIMITS.description} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}>Photo/Evidence (Optional)</span>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoUpload} style={{ display: 'none' }} id="photoInput" />
                <label
                  htmlFor="photoInput"
                  style={{ display: 'block', padding: '32px 20px', border: '2px dashed #CCCCCC', borderRadius: 4, textAlign: 'center', cursor: 'pointer', background: '#F9F9F9', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#003DA5'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#CCCCCC'}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📸</div>
                  <p style={{ fontSize: 13, color: '#333333', fontWeight: 600, margin: '0 0 4px 0' }}>Click to upload photo or drag &amp; drop</p>
                  <p style={{ fontSize: 12, color: '#666666', margin: 0 }}>JPG or PNG • Max {MAX_UPLOAD_BYTES / (1024 * 1024)}MB</p>
                </label>
              </div>
              {photoSelectError && (
                <p style={{ color: '#C62828', fontSize: 12, marginTop: 4, marginBottom: 12 }}>{photoSelectError}</p>
              )}
              {formData.photoFile && (
                <div style={{ padding: 12, background: '#F0F8FF', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#003DA5' }}>✓ {formData.photoFile.name}</span>
                  <button aria-label="Remove file" onClick={() => setFormData(prev => ({ ...prev, photoFile: null, photoPreview: null }))} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14, color: '#333333', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isAnonymous}
                onChange={(e) => handleInputChange('isAnonymous', e.target.checked ? 'true' : 'false')}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              Submit anonymously (your name and phone number will not be shown to responders)
            </label>
            {errorMessage && (
              <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, fontSize: 13, color: '#B91C1C' }}>
                {errorMessage}
              </div>
            )}
            <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, marginTop: 8 }}>
              Submit Report
            </Button>
            <p style={{ fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 12 }}>
              {formData.photoFile ? (
                // Not a promise: the attach happens after the report is filed and
                // can fail. The confirmation screen reports what actually happened.
                <span>Your photo is attached once the report is filed — that is what marks it verified.</span>
              ) : (
                <span style={{ color: '#C62828' }}>⚠️ Reports without photos will be marked as unverified.</span>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 32 }}>
          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Expected Response Time</h3>
            {config ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {([
                  ['critical', config.sla_hours_critical],
                  ['high', config.sla_hours_high],
                  ['medium', config.sla_hours_medium],
                  ['low', config.sla_hours_low],
                ] as const).map(([level, hours]) => (
                  <div key={level} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: '#333333', fontWeight: 500 }}>{LEVEL_META[level].label}</span>
                    <span style={{ color: LEVEL_META[level].color, fontWeight: 600 }}>{formatSla(hours)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#666666' }}>Response targets unavailable right now.</p>
            )}
          </div>
          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
            {/* Not an automatic route: the mapping is the suggestion staff
                confirm or override when they route the report (SCRUM-192). */}
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>Which Department Handles It</h3>
            <p style={{ fontSize: 13, color: '#666666', marginBottom: 16, lineHeight: 1.6 }}>Our staff review each report and send it to the right department. Usually:</p>
            <ul style={{ fontSize: 12, color: '#333333', lineHeight: 1.8, listStyle: 'none', paddingLeft: 0 }}>
              {routingSummary.map(({ department, types }) => (
                <li key={department}>• {types} &mdash; {department}</li>
              ))}
            </ul>
          </div>
          <div className="rounded shadow-sm" style={{ padding: '24px 32px', background: '#DC2626', color: 'white', border: '1px solid #DC2626' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🚨 Emergency?</h3>
            <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12, color: 'rgba(255,255,255,0.9)' }}>For life-threatening emergencies, call emergency services immediately.</p>
            {hotlines.length > 0 && (
              <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                {hotlines.map((line) => (
                  <div key={`${line.kind}-${line.sort_order}`}>📞 {line.label}: {line.value}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function IncidentPage() {
  return (
    <ProtectedRoute>
      <IncidentContent />
    </ProtectedRoute>
  );
}
