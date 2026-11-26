import { describe, it, expect } from 'vitest';
import { capturePage, describeBrowser, recordPath } from '@/portals/citizen/features/system-issues/lib/capture-context';

describe('capturePage', () => {
  // jsdom sits on `/` with no referrer. The trail is module state, so this
  // runs before anything is recorded.
  it('falls back to the page the Citizen is on when nothing came before it', () => {
    expect(capturePage()).toBe('/');
  });

  it('gives the page before the current one after an in-app navigation', () => {
    recordPath('/yellow-card');
    recordPath('/');

    expect(capturePage()).toBe('/yellow-card');
  });
});

describe('describeBrowser', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'Chrome on Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Linux; Android 14; SM-A146P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari on iPhone or iPad'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox on Mac'],
    ['', 'your browser'],
  ])('%s -> %s', (ua, expected) => {
    expect(describeBrowser(ua)).toBe(expected);
  });
});
