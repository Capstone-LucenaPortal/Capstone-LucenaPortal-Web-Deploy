import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMySystemIssues } from '@/portals/citizen/features/system-issues/lib/system-issues';

// A thenable query builder that records what was asked for. `client.value`
// null is mock mode: no backend configured.
vi.mock('@/portals/citizen/lib/supabase/client', () => {
  const calls: { table?: string; select?: string; order?: [string, unknown] } = {};
  const result = { value: { data: [] as unknown[] | null, error: null as unknown } };
  const builder = {
    select(cols: string) { calls.select = cols; return builder; },
    order(col: string, opts: unknown) { calls.order = [col, opts]; return builder; },
    then(resolve: (r: unknown) => void) { resolve(result.value); },
  };
  const live = { from: (table: string) => { calls.table = table; return builder; } };
  const client = { value: live as unknown };
  return { getSupabaseClient: () => client.value, __mock: { calls, result, client, live } };
});

type Mock = {
  calls: { table?: string; select?: string; order?: [string, unknown] };
  result: { value: { data: unknown[] | null; error: unknown } };
  client: { value: unknown };
  live: unknown;
};
let m: Mock;

beforeEach(async () => {
  m = ((await import('@/portals/citizen/lib/supabase/client')) as unknown as { __mock: Mock }).__mock;
  m.calls.table = m.calls.select = m.calls.order = undefined;
  m.result.value = { data: [], error: null };
  m.client.value = m.live;
});

/** A `my_system_issues` row as PostgREST returns it. */
const resolvedRow = {
  id: 'si-1',
  reference_number: 'SI-2026-000012',
  created_at: '2026-11-20T02:00:00+00:00',
  category: 'lcc',
  description: 'The booking calendar never finishes loading.',
  captured_page: '/lcc',
  user_agent: 'Mozilla/5.0',
  status: 'resolved',
  resolved_at: '2026-11-24T02:00:00+00:00',
  resolution_note: 'A slow query was fixed.',
  closes_at: '2026-12-01T02:00:00+00:00',
  closed_at: null,
  close_reason: null,
  close_note: null,
  updated_at: '2026-11-24T02:00:00+00:00',
};

describe('getMySystemIssues in mock mode', () => {
  it('returns no System issues rather than faking rows', async () => {
    m.client.value = null;
    await expect(getMySystemIssues()).resolves.toEqual([]);
  });
});

describe('getMySystemIssues live', () => {
  it("reads the Citizen's own view, newest first", async () => {
    await getMySystemIssues();
    expect(m.calls.table).toBe('my_system_issues');
    expect(m.calls.order).toEqual(['created_at', { ascending: false }]);
  });

  it('maps a resolved row, keeping the derived status and the auto-close date', async () => {
    m.result.value = { data: [resolvedRow], error: null };
    await expect(getMySystemIssues()).resolves.toEqual([
      {
        id: 'si-1',
        referenceNumber: 'SI-2026-000012',
        category: 'lcc',
        description: 'The booking calendar never finishes loading.',
        status: 'resolved',
        createdAt: '2026-11-20T02:00:00+00:00',
        resolutionNote: 'A slow query was fixed.',
        closesAt: '2026-12-01T02:00:00+00:00',
        closeReason: null,
        closeNote: null,
      },
    ]);
  });

  it('maps a row closed with a reason, with its reason and note', async () => {
    m.result.value = {
      data: [{
        ...resolvedRow,
        status: 'closed',
        resolved_at: null,
        resolution_note: null,
        closes_at: null,
        closed_at: '2026-11-21T02:00:00+00:00',
        close_reason: 'duplicate',
        close_note: 'Same as SI-2026-000011.',
      }],
      error: null,
    };
    const [issue] = await getMySystemIssues();
    expect(issue).toMatchObject({
      status: 'closed',
      resolutionNote: null,
      closesAt: null,
      closeReason: 'duplicate',
      closeNote: 'Same as SI-2026-000011.',
    });
  });

  // The status is the database's to derive: a row without one the portal knows
  // is left out, never shown as a status the portal made up.
  it('leaves out a row whose status or area is not one the database defines', async () => {
    m.result.value = {
      data: [
        { ...resolvedRow, id: 'si-null-status', status: null },
        { ...resolvedRow, id: 'si-new-status', status: 'reopened' },
        { ...resolvedRow, id: 'si-null-area', category: null },
        resolvedRow,
      ],
      error: null,
    };
    const issues = await getMySystemIssues();
    expect(issues.map((i) => i.id)).toEqual(['si-1']);
  });

  it('throws Citizen copy, never the raw PostgREST text, when the read fails', async () => {
    m.result.value = { data: null, error: { message: 'relation "my_system_issues" does not exist' } };
    await expect(getMySystemIssues()).rejects.toThrow(
      'Could not load the website problems you reported right now. Please try again later.',
    );
  });

  it('returns an empty list when the view returns no data', async () => {
    m.result.value = { data: null, error: null };
    await expect(getMySystemIssues()).resolves.toEqual([]);
  });
});
