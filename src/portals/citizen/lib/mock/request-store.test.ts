import { describe, it, expect, beforeEach } from 'vitest';

// The vitest environment for this project is 'node', which has no `localStorage` global.
// requestService reads/writes localStorage directly, so a minimal in-memory polyfill is
// installed here to let that code path run under test (pattern copied from the top of
// services/bookingService.test.ts).
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}
// requestService also branches on `typeof window` for SSR-safety. Stub it so the
// browser-path code under test actually executes instead of short-circuiting to [].
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}

import { requestService } from '@/portals/citizen/lib/mock/request-store';

describe('requestService storage corruption', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] and clears the key when localStorage holds invalid JSON', () => {
    localStorage.setItem('requests', '{not json');
    expect(requestService.getRequests()).toEqual([]);
    expect(localStorage.getItem('requests')).toBeNull();
  });
});
