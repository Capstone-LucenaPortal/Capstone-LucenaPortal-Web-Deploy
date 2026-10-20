'use client';

import { useId, useRef, useState } from 'react';
import type { MyIncident, PhotoUploadProgress } from '@/portals/citizen/features/incidents/types';
import { confirmResolution, reopenIncident, uploadIncidentPhoto, IncidentPhotoError } from '@/portals/citizen/features/incidents/lib/incidents';
import type { IncidentConfig } from '@/portals/citizen/lib/supabase/catalogs';
import {
  actionRow,
  addDays,
  deadlineNote,
  formatDeadline,
  inlineError,
  inlineNotice,
  primaryAction,
  reasonTextarea,
  secondaryAction,
} from '../lib/action-styles';
import ResolutionPhotos from './resolution-photos';

interface Props {
  incident: MyIncident;
  config: IncidentConfig | null;
  /** Refetch the dashboard once the server state has actually changed. */
  onChanged: () => void;
}

/**
 * The two citizen-side controls the incident lifecycle needs and the dashboard
 * never had.
 *
 * `resolved` → confirm or reopen. The DB's own sweeper writes a notification
 * saying "Confirm it in the portal, or it will close automatically", which
 * until now pointed at a control that did not exist. Worse, the cap counted in
 * `max_active_reports_per_citizen` includes `resolved` reports, so every
 * unconfirmed resolution held a slot until the auto-close sweep freed it days
 * later.
 *
 * `!is_verified` → add a photo. `request_incident_photo_upload` accepts the
 * reporter on any non-closed report and the sweeper nudges at `nudge_day`, but
 * the only upload entry point in the portal was the submission page itself. The
 * dashboard displayed "awaiting photo confirmation" with nothing to act on.
 */
export default function IncidentCardActions({ incident, config, onChanged }: Props) {
  const [busy, setBusy] = useState<null | 'confirm' | 'reopen' | 'photo'>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReopen, setShowReopen] = useState(false);
  const [reason, setReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reasonId = useId();

  // A failed attempt hands back its reservation so a retry resumes instead of
  // re-reserving. That matters here: the per-cycle photo cap is charged at
  // RESERVATION, so a naive retry loop would burn the citizen's remaining
  // slots and can permanently strand the report — only a reopen resets it.
  const photoProgress = useRef<PhotoUploadProgress | undefined>(undefined);

  const run = async (kind: 'confirm' | 'reopen', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      setShowReopen(false);
      setReason('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    setError(null);
    try {
      await uploadIncidentPhoto(incident.id, file, photoProgress.current);
      photoProgress.current = undefined;
      onChanged();
    } catch (err) {
      if (err instanceof IncidentPhotoError) {
        photoProgress.current = err.progress;
        setError(err.message);
      } else {
        setError('We could not attach your photo right now. Please try again.');
      }
    } finally {
      setBusy(null);
      // Let the citizen re-pick the same file after a failure; without this the
      // input's value is unchanged and `change` never fires again.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isResolved = incident.status === 'resolved';
  const needsPhoto = !incident.is_verified && incident.status !== 'closed';

  const confirmBy = isResolved
    ? addDays(incident.resolved_at, config?.confirmation_window_days)
    : null;
  const verifyBy = needsPhoto
    ? addDays(incident.submitted_at, config?.auto_close_day)
    : null;

  if (!isResolved && !needsPhoto) return null;

  return (
    <div>
      {isResolved && (
        <>
          <div style={inlineNotice}>
            This report has been marked resolved. Is it actually fixed?
            {confirmBy && (
              <>
                {' '}Confirm by <strong>{formatDeadline(confirmBy)}</strong> or it closes automatically.
              </>
            )}
          </div>
          <ResolutionPhotos incidentId={incident.id} />
          <div style={actionRow}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('confirm', () => confirmResolution(incident.id))}
              style={primaryAction('#10B981', busy !== null)}
            >
              {busy === 'confirm' ? 'Confirming…' : "Yes, it's fixed"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              aria-expanded={showReopen}
              onClick={() => setShowReopen((v) => !v)}
              style={secondaryAction(busy !== null)}
            >
              Not fixed — reopen
            </button>
          </div>

          {showReopen && (
            <div style={{ marginTop: 12 }}>
              <label
                htmlFor={reasonId}
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
              >
                What is still wrong?
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={reasonTextarea}
                placeholder="Tell the department what still needs fixing."
                aria-describedby={error ? `${reasonId}-error` : undefined}
                aria-invalid={error ? true : undefined}
              />
              <div style={actionRow}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('reopen', () => reopenIncident(incident.id, reason))}
                  style={primaryAction('#F97316', busy !== null)}
                >
                  {busy === 'reopen' ? 'Reopening…' : 'Reopen this report'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {needsPhoto && (
        <>
          <div style={deadlineNote}>
            ❓ This report is not verified yet. Add a photo so the department can act on it
            {verifyBy && (
              <>
                {' '}— unverified reports close automatically on <strong>{formatDeadline(verifyBy)}</strong>
              </>
            )}
            .
          </div>
          <div style={actionRow}>
            <label
              style={{ ...secondaryAction(busy !== null), display: 'inline-block' }}
            >
              {busy === 'photo' ? 'Uploading…' : 'Add a photo'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                disabled={busy !== null}
                onChange={(e) => void onPhotoPicked(e.target.files?.[0])}
                style={{
                  // Visually hidden, not display:none — a display:none input is
                  // skipped by some assistive tech, and the wrapping <label>
                  // already provides the accessible name and click target.
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              />
            </label>
          </div>
        </>
      )}

      {error && (
        <p id={`${reasonId}-error`} role="alert" style={inlineError}>
          {error}
        </p>
      )}
    </div>
  );
}
