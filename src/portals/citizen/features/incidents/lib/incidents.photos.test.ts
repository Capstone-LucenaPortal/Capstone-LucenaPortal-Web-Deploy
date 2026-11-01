import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getResolutionPhotos, getIncidentPhotoUrl, PHOTO_URL_TTL_SECONDS, uploadIncidentPhoto, IncidentPhotoError } from '@/portals/citizen/features/incidents/lib/incidents';
import type { PhotoUploadProgress } from '@/portals/citizen/features/incidents/types';

// A thenable query builder that records every filter, so the test can assert on
// what was asked for rather than on how the chain was spelled.
vi.mock('@/portals/citizen/lib/supabase/client', () => {
  const calls: { table?: string; select?: string; eq: [string, unknown][]; order?: string } = { eq: [] };
  const rows = { value: [] as unknown[] };
  const builder = {
    select(cols: string) { calls.select = cols; return builder; },
    eq(col: string, val: unknown) { calls.eq.push([col, val]); return builder; },
    order(col: string) { calls.order = col; return builder; },
    then(resolve: (r: { data: unknown[]; error: null }) => void) { resolve({ data: rows.value, error: null }); },
  };
  const rpc = vi.fn();
  const createSignedUrl = vi.fn();
  const upload = vi.fn();
  const storageFrom = vi.fn(() => ({ createSignedUrl, upload }));
  const client = {
    from: (table: string) => { calls.table = table; return builder; },
    rpc,
    storage: { from: storageFrom },
  };
  return { getSupabaseClient: () => client, __mock: { calls, rows, rpc, createSignedUrl, upload, storageFrom } };
});

type Mock = {
  calls: { table?: string; select?: string; eq: [string, unknown][]; order?: string };
  rows: { value: unknown[] };
  rpc: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
  storageFrom: ReturnType<typeof vi.fn>;
};
let m: Mock;

beforeEach(async () => {
  m = ((await import('@/portals/citizen/lib/supabase/client')) as unknown as { __mock: Mock }).__mock;
  m.calls.eq.length = 0;
  m.calls.table = m.calls.select = m.calls.order = undefined;
  m.rows.value = [];
  m.rpc.mockReset();
  m.createSignedUrl.mockReset();
  m.upload.mockReset();
  m.storageFrom.mockClear();
});

/**
 * SCRUM-190. The citizen confirming a resolution must see the responder's
 * evidence for THAT resolution: after photos, from the current cycle, of this
 * incident. A reopened incident keeps last cycle's after photos, and showing
 * those beside "Is it actually fixed?" would be evidence of the wrong repair.
 */
describe('getResolutionPhotos', () => {
  it('reads the citizen view, never the base table or a staff view', async () => {
    await getResolutionPhotos('inc-1');
    expect(m.calls.table).toBe('my_incident_photos');
  });

  it("asks only for this incident's current-cycle after photos", async () => {
    await getResolutionPhotos('inc-1');
    expect(m.calls.eq).toEqual(
      expect.arrayContaining([
        ['incident_id', 'inc-1'],
        ['kind', 'after'],
        ['is_current_cycle', true],
      ]),
    );
  });

  it('never filters on the caller — the view already scopes to auth.uid()', async () => {
    await getResolutionPhotos('inc-1');
    const cols = m.calls.eq.map(([c]) => c);
    expect(cols).not.toContain('citizen_id');
    expect(cols).not.toContain('user_id');
  });

  it('returns the rows the view gives back', async () => {
    m.rows.value = [{ id: 'ph-1', incident_id: 'inc-1', kind: 'after', cycle_number: 1, is_current_cycle: true, uploaded_at: '2026-10-01T03:00:00Z' }];
    expect(await getResolutionPhotos('inc-1')).toEqual(m.rows.value);
  });
});

describe('getIncidentPhotoUrl', () => {
  it('re-checks entitlement through get_document_path, then signs a short-lived URL', async () => {
    m.rpc.mockResolvedValue({ data: [{ bucket: 'incident-photos', path: 'inc-1/ph-1.jpg' }], error: null });
    m.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/ph-1' }, error: null });

    const url = await getIncidentPhotoUrl('ph-1');

    expect(m.rpc).toHaveBeenCalledWith('get_document_path', { p_kind: 'incident_photo', p_row_id: 'ph-1' });
    expect(m.storageFrom).toHaveBeenCalledWith('incident-photos');
    expect(m.createSignedUrl).toHaveBeenCalledWith('inc-1/ph-1.jpg', PHOTO_URL_TTL_SECONDS);
    expect(url).toBe('https://signed.example/ph-1');
  });

  it('keeps the link short-lived — a minute, not a durable URL', () => {
    expect(PHOTO_URL_TTL_SECONDS).toBeLessThanOrEqual(60);
  });

  it('returns null, without signing anything, when the gate admits no row', async () => {
    m.rpc.mockResolvedValue({ data: [], error: null });
    expect(await getIncidentPhotoUrl('someone-elses-photo')).toBeNull();
    expect(m.createSignedUrl).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when the lookup fails', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'nope' } });
    await expect(getIncidentPhotoUrl('ph-1')).resolves.toBeNull();
  });
});

/**
 * #71. Since DB l90 an unconfirmed reservation is live for 15 minutes and
 * stale after; the database refuses a stale one at both later steps (the bucket
 * policy at upload, PT404 at confirm). A resume against a stale reservation
 * must start over once with a fresh one, not fail on every Retry.
 */
describe('uploadIncidentPhoto resuming a reservation', () => {
  const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
  const held = (bytesLanded: boolean): PhotoUploadProgress => ({
    rowId: 'old-row',
    bucket: 'incident-photos',
    storagePath: 'inc-1/old-row.jpg',
    bytesLanded,
  });
  const fresh = { row_id: 'new-row', bucket: 'incident-photos', storage_path: 'inc-1/new-row.jpg' };
  const expired = {
    code: 'PT404',
    message: 'confirm_upload: incident_photo reservation old-row has expired — request a new upload',
  };
  // What the bucket's INSERT policy hands back for a stale path (QA, sandbox).
  const rlsRefusal = Object.assign(new Error('new row violates row-level security policy'), {
    status: 400,
    statusCode: '403',
    code: 'AccessDenied',
  });

  // Scripted `rpc` by function name; each entry is consumed in order.
  const script = (byName: Record<string, { data?: unknown; error: unknown }[]>) => {
    m.rpc.mockImplementation(async (name: string) => {
      const next = byName[name]?.shift();
      if (!next) throw new Error(`unscripted rpc ${name}`);
      return { data: next.data ?? null, error: next.error };
    });
  };
  const reserveCalls = () => m.rpc.mock.calls.filter(([name]) => name === 'request_incident_photo_upload');
  const confirmCalls = () => m.rpc.mock.calls.filter(([name]) => name === 'confirm_upload');

  it('re-reserves and succeeds when a confirm-stage resume gets PT404', async () => {
    script({
      confirm_upload: [{ error: expired }, { error: null }],
      request_incident_photo_upload: [{ data: [fresh], error: null }],
    });
    m.upload.mockResolvedValue({ data: {}, error: null });

    await expect(uploadIncidentPhoto('inc-1', photo(), held(true))).resolves.toBeUndefined();

    expect(reserveCalls()).toHaveLength(1);
    expect(m.upload).toHaveBeenCalledTimes(1);
    expect(m.upload.mock.calls[0][0]).toBe('inc-1/new-row.jpg');
    expect(confirmCalls().map(([, args]) => args.p_row_id)).toEqual(['old-row', 'new-row']);
  });

  it('re-reserves and succeeds when an upload-stage resume is refused by the bucket policy', async () => {
    script({
      request_incident_photo_upload: [{ data: [fresh], error: null }],
      confirm_upload: [{ error: null }],
    });
    m.upload
      .mockResolvedValueOnce({ data: null, error: rlsRefusal })
      .mockResolvedValueOnce({ data: {}, error: null });

    await expect(uploadIncidentPhoto('inc-1', photo(), held(false))).resolves.toBeUndefined();

    expect(reserveCalls()).toHaveLength(1);
    expect(m.upload.mock.calls.map(([path]) => path)).toEqual(['inc-1/old-row.jpg', 'inc-1/new-row.jpg']);
    expect(confirmCalls().map(([, args]) => args.p_row_id)).toEqual(['new-row']);
  });

  it('resumes a live reservation without reserving again', async () => {
    script({ confirm_upload: [{ error: null }] });
    m.upload.mockResolvedValue({ data: {}, error: null });

    await expect(uploadIncidentPhoto('inc-1', photo(), held(false))).resolves.toBeUndefined();

    expect(reserveCalls()).toHaveLength(0);
    expect(m.upload.mock.calls[0][0]).toBe('inc-1/old-row.jpg');
    expect(confirmCalls().map(([, args]) => args.p_row_id)).toEqual(['old-row']);
  });

  it('does not re-reserve when a first attempt is refused by the bucket policy', async () => {
    script({ request_incident_photo_upload: [{ data: [fresh], error: null }] });
    m.upload.mockResolvedValue({ data: null, error: rlsRefusal });

    const err = await uploadIncidentPhoto('inc-1', photo()).catch((e) => e);

    expect(err).toBeInstanceOf(IncidentPhotoError);
    expect(reserveCalls()).toHaveLength(1);
    expect(m.upload).toHaveBeenCalledTimes(1);
    expect(err.progress).toEqual({ rowId: 'new-row', bucket: 'incident-photos', storagePath: 'inc-1/new-row.jpg', bytesLanded: false });
  });

  it('restarts only once, and a failed restart hands back the new reservation', async () => {
    script({
      confirm_upload: [{ error: expired }, { error: { code: 'XX000', message: 'boom' } }],
      request_incident_photo_upload: [{ data: [fresh], error: null }],
    });
    m.upload.mockResolvedValue({ data: {}, error: null });

    const err = await uploadIncidentPhoto('inc-1', photo(), held(true)).catch((e) => e);

    expect(err).toBeInstanceOf(IncidentPhotoError);
    expect(reserveCalls()).toHaveLength(1);
    expect(err.progress).toEqual({ rowId: 'new-row', bucket: 'incident-photos', storagePath: 'inc-1/new-row.jpg', bytesLanded: true });
  });

  it('hands back no progress when the fresh reservation itself is refused', async () => {
    script({
      confirm_upload: [{ error: expired }],
      request_incident_photo_upload: [{ error: { code: '23514', message: 'already 3 before photos this cycle (limit 3)' } }],
    });

    const err = await uploadIncidentPhoto('inc-1', photo(), held(true)).catch((e) => e);

    expect(err).toBeInstanceOf(IncidentPhotoError);
    expect(err.message).toBe('This report already has the maximum number of photos.');
    expect(err.progress).toBeUndefined();
  });
});
