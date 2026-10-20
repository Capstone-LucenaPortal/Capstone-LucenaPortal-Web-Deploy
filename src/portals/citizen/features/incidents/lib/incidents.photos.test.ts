import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getResolutionPhotos, getIncidentPhotoUrl, PHOTO_URL_TTL_SECONDS } from '@/portals/citizen/features/incidents/lib/incidents';

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
  const storageFrom = vi.fn(() => ({ createSignedUrl }));
  const client = {
    from: (table: string) => { calls.table = table; return builder; },
    rpc,
    storage: { from: storageFrom },
  };
  return { getSupabaseClient: () => client, __mock: { calls, rows, rpc, createSignedUrl, storageFrom } };
});

type Mock = {
  calls: { table?: string; select?: string; eq: [string, unknown][]; order?: string };
  rows: { value: unknown[] };
  rpc: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
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
