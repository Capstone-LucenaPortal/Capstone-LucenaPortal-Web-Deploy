import { describe, it, expect } from 'vitest';
import type { IncidentSubmission } from '@/portals/citizen/features/incidents/types';
import { mapIncidentToParams, IncidentSubmitError, getMyIncidents, translateSubmitError, translateIncidentUploadError, uploadIncidentPhoto, confirmResolution, reopenIncident, translateResolutionActionError, getResolutionPhotos, getIncidentPhotoUrl } from '@/portals/citizen/features/incidents/lib/incidents';

// Codes here are real `public_incident_types` / `public_barangays` codes — the
// form now feeds catalog codes straight through, so this fixture mirrors what
// catalogService hands the page.
const base: IncidentSubmission = {
  incidentTypeCode: 'streetlight_outage',
  incidentTypeLabel: 'Streetlight outage',
  location: 'Quezon Avenue, near City Hall',
  barangayCode: 'brgy_1',
  barangayLabel: 'Barangay 1',
  description: 'Lamp post is dark at night.',
  isAnonymous: false,
  hasPhoto: false,
};

describe('mapIncidentToParams', () => {
  it('passes the catalog incident type code through untouched', () => {
    expect(mapIncidentToParams(base).p_incident_type_code).toBe('streetlight_outage');
  });

  it('passes the catalog barangay code through untouched', () => {
    expect(mapIncidentToParams(base).p_barangay_code).toBe('brgy_1');
  });

  it('passes description and location through to the right params', () => {
    const params = mapIncidentToParams(base);
    expect(params.p_description).toBe('Lamp post is dark at night.');
    expect(params.p_address).toBe('Quezon Avenue, near City Hall');
  });

  it('reflects isAnonymous in p_is_anonymous', () => {
    expect(mapIncidentToParams({ ...base, isAnonymous: true }).p_is_anonymous).toBe(true);
  });

  it('throws IncidentSubmitError when no incident type was selected', () => {
    expect(() => mapIncidentToParams({ ...base, incidentTypeCode: '' })).toThrow(IncidentSubmitError);
  });

  it('throws IncidentSubmitError when no barangay was selected', () => {
    expect(() => mapIncidentToParams({ ...base, barangayCode: '' })).toThrow(IncidentSubmitError);
  });

  it('throws IncidentSubmitError when the description is blank or whitespace-only', () => {
    expect(() => mapIncidentToParams({ ...base, description: '' })).toThrow(IncidentSubmitError);
    expect(() => mapIncidentToParams({ ...base, description: '   ' })).toThrow(IncidentSubmitError);
  });

  it('throws IncidentSubmitError when the location is blank or whitespace-only', () => {
    expect(() => mapIncidentToParams({ ...base, location: '' })).toThrow(IncidentSubmitError);
    expect(() => mapIncidentToParams({ ...base, location: '   ' })).toThrow(IncidentSubmitError);
  });

  it('throws IncidentSubmitError when the description exceeds LIMITS.description', () => {
    expect(() => mapIncidentToParams({ ...base, description: 'a'.repeat(2001) })).toThrow(IncidentSubmitError);
  });

  it('throws IncidentSubmitError when the location exceeds LIMITS.address', () => {
    expect(() => mapIncidentToParams({ ...base, location: 'a'.repeat(301) })).toThrow(IncidentSubmitError);
  });

  it('trims description and location before mapping', () => {
    const params = mapIncidentToParams({ ...base, description: '  Lamp post is dark.  ', location: '  Quezon Ave  ' });
    expect(params.p_description).toBe('Lamp post is dark.');
    expect(params.p_address).toBe('Quezon Ave');
  });
});

describe('getMyIncidents in mock mode (no backend)', () => {
  it('resolves [] when no backend is configured', async () => {
    expect(await getMyIncidents()).toEqual([]);
  });
});

// Read-only methods return []/null in mock mode rather than faking rows.
describe('resolution photos in mock mode (no backend)', () => {
  it('getResolutionPhotos resolves []', async () => {
    expect(await getResolutionPhotos('inc-1')).toEqual([]);
  });

  it('getIncidentPhotoUrl resolves null', async () => {
    expect(await getIncidentPhotoUrl('ph-1')).toBeNull();
  });
});

describe('translateSubmitError', () => {
  it('maps 42501 to a sign-in prompt', () => {
    expect(translateSubmitError('42501')).toBe('Please sign in to file a report.');
  });

  it('maps P0002 to a complete-your-profile prompt', () => {
    expect(translateSubmitError('P0002')).toBe(
      'Please complete your profile before reporting an incident.',
    );
  });

  it('maps 22023 to a required-fields message', () => {
    expect(translateSubmitError('22023')).toBe('A description and location are required.');
  });

  it('maps 23503 to a pick-another-option message', () => {
    expect(translateSubmitError('23503')).toBe(
      'That option is no longer available. Please pick another.',
    );
  });

  // Finding 4: the cap counts every report that is not `closed`, which includes
  // `resolved`. Telling a citizen to wait for resolution was advice that could
  // never free a slot.
  it('tells the citizen a slot frees up on close, not on resolve', () => {
    expect(translateSubmitError('23514')).toBe(
      'You have reached the maximum number of open reports. A slot frees up when a report is closed — confirming a resolved report closes it.',
    );
  });

  it('falls back for an unrecognised code', () => {
    expect(translateSubmitError('XX999')).toBe(
      'We could not submit your report right now. Please try again later.',
    );
  });

  it('falls back when the code is undefined', () => {
    expect(translateSubmitError(undefined)).toBe(
      'We could not submit your report right now. Please try again later.',
    );
  });
});

describe('translateIncidentUploadError', () => {
  it('names the size limit when storage reports the file too large', () => {
    expect(
      translateIncidentUploadError('upload', undefined, 'The object exceeded the maximum allowed size'),
    ).toBe('That file is too large. Please upload a file under 5MB.');
  });

  it('names the accepted types when storage reports a bad mime type', () => {
    expect(
      translateIncidentUploadError('upload', undefined, 'invalid_mime_type: image/gif'),
    ).toBe('That file type is not accepted. Please upload a JPG, PNG or PDF.');
  });

  it('maps 42501 to a report-not-accepting-photos message', () => {
    expect(
      translateIncidentUploadError('reserve', '42501', 'request_incident_photo_upload: that report is not yours'),
    ).toBe('That report is not accepting photos right now.');
  });

  it('maps 23514 to the per-report photo cap', () => {
    expect(
      translateIncidentUploadError('reserve', '23514', 'already 3 before photos this cycle (limit 3)'),
    ).toBe('This report already has the maximum number of photos.');
  });

  it('names both constraints for 22023, which is ambiguous by code alone', () => {
    expect(translateIncidentUploadError('reserve', '22023', 'gif is not an accepted file type')).toBe(
      'That file was not accepted. Please upload a JPG, PNG or PDF under 5MB.',
    );
  });

  it('distinguishes P0002 at reserve from P0002 at confirm', () => {
    expect(translateIncidentUploadError('reserve', 'P0002', 'no incident abc')).toBe(
      'We could not find that report.',
    );
    expect(translateIncidentUploadError('confirm', 'P0002', 'no unconfirmed reservation')).toBe(
      'Your photo was uploaded but we could not finish attaching it. Please try again.',
    );
  });

  it('falls back for an unrecognised code', () => {
    expect(translateIncidentUploadError('reserve', 'XX999', 'boom')).toBe(
      'We could not attach your photo right now. Please try again.',
    );
  });

  // Regression (F2): the database freely interpolates reference numbers into
  // its error text, and '413' can appear inside one (e.g. INC-2026-000413).
  // When a real errcode is present it must decide alone — text must never
  // hijack it into the unrelated "file too large" message.
  it('does not let a bare "413" inside a reference number override a real errcode', () => {
    expect(
      translateIncidentUploadError(
        'reserve',
        '42501',
        'request_incident_photo_upload: INC-2026-000413 is closed',
      ),
    ).toBe('That report is not accepting photos right now.');
  });

  it('still names the size limit when the same text arrives with no errcode (upload stage)', () => {
    expect(
      translateIncidentUploadError('upload', undefined, 'The object exceeded the maximum allowed size'),
    ).toBe('That file is too large. Please upload a file under 5MB.');
  });
});

describe('uploadIncidentPhoto in mock mode (no backend)', () => {
  it('resolves without throwing', async () => {
    const file = new File(['test'], 'pothole.jpg', { type: 'image/jpeg' });
    await expect(uploadIncidentPhoto('mock-incident-id', file)).resolves.toBeUndefined();
  });
});

describe('translateResolutionActionError', () => {
  // Both RPCs answer every "you may not do this" case with 42501 — not yours,
  // not resolved, already confirmed, window closed. One sentence covers them.
  it('reports a 42501 refusal as no longer awaiting confirmation', () => {
    expect(translateResolutionActionError('42501')).toBe(
      'This report is no longer awaiting your confirmation.',
    );
  });

  it('asks for a reason on a blank-reason refusal', () => {
    expect(translateResolutionActionError('22023')).toMatch(/why it isn't fixed/i);
  });

  it('never returns raw Postgres text for an unknown code', () => {
    const msg = translateResolutionActionError('XX999');
    expect(msg).toMatch(/could not update/i);
    expect(msg).not.toMatch(/incident|constraint|null/i);
  });
});

describe('confirmResolution in mock mode (no backend)', () => {
  it('resolves without throwing and without inventing a record', async () => {
    await expect(confirmResolution('incident-1')).resolves.toBeUndefined();
  });
});

describe('reopenIncident', () => {
  // Validated client-side so an empty textarea gives inline feedback instead of
  // a round-trip that comes back as raw Postgres text.
  it('rejects a blank reason before reaching the network', async () => {
    await expect(reopenIncident('incident-1', '   ')).rejects.toBeInstanceOf(IncidentSubmitError);
    await expect(reopenIncident('incident-1', '')).rejects.toThrow(/why it isn't fixed/i);
  });

  it('rejects a reason longer than the description limit', async () => {
    await expect(reopenIncident('incident-1', 'x'.repeat(5000))).rejects.toBeInstanceOf(
      IncidentSubmitError,
    );
  });

  it('is a no-op in mock mode once the reason is valid', async () => {
    await expect(
      reopenIncident('incident-1', 'The streetlight is still dark.'),
    ).resolves.toBeUndefined();
  });
});
