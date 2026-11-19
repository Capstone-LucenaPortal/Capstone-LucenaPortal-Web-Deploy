import { describe, it, expect } from 'vitest';
import { settle } from '@/portals/citizen/lib/loaded';

const FALLBACK = 'Could not load this right now.';

describe('settle', () => {
  it('keeps the rows of a read that succeeds, even an empty one', async () => {
    expect(await settle(Promise.resolve([]), FALLBACK)).toEqual({ ok: true, data: [] });
  });

  it("keeps the service's own message for a read that fails", async () => {
    const result = await settle(Promise.reject(new Error('Could not load your incident reports.')), FALLBACK);
    expect(result).toEqual({ ok: false, error: 'Could not load your incident reports.' });
  });

  // A failed read must still read as failed when there is no text to show.
  it.each([
    ['an error with no message', new Error('')],
    ['something that is not an error', 'offline'],
  ])('falls back to the given message for %s', async (_label, thrown) => {
    expect(await settle(Promise.reject(thrown), FALLBACK)).toEqual({ ok: false, error: FALLBACK });
  });
});
