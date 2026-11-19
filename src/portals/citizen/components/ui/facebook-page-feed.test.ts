import { describe, expect, it } from 'vitest';
import { feedScale } from './facebook-page-feed';

describe('feedScale', () => {
  it('magnifies the 500px feed to fill a wider column', () => {
    expect(feedScale(750, 1.8)).toBe(1.5);
  });

  it('stops at the largest magnification allowed', () => {
    expect(feedScale(1200, 1.8)).toBe(1.8);
  });

  it('never shrinks the feed: a narrow column gets the plugin at its own size', () => {
    expect(feedScale(390, 1.8)).toBe(1);
  });
});
