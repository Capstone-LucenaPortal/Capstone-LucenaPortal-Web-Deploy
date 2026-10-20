import { describe, it, expect } from 'vitest';
import {
  PROFILE_TABS,
  PROFILE_TAB_YELLOW_CARD,
  profileTabFromQuery,
} from '@/portals/citizen/features/profile/lib/tabs';

describe('profileTabFromQuery', () => {
  it('opens any tab the profile page actually renders', () => {
    for (const tab of PROFILE_TABS) {
      expect(profileTabFromQuery(tab)).toBe(tab);
    }
  });

  // The page renders a panel per `activeTab === '<name>'`, so an unknown value
  // would render no panel at all — a blank page under the tab strip. Falling
  // back to a real tab is what keeps a stale or mistyped link harmless.
  it.each([null, undefined, '', 'yellow-card', 'YellowCard', 'account '])(
    'falls back to Account Details for %p',
    (value) => {
      expect(profileTabFromQuery(value)).toBe('account');
    },
  );
});

describe('PROFILE_TAB_YELLOW_CARD', () => {
  // The whole point of the constant: `/yellow-card` links an approved applicant
  // to their card with it, so it has to be a tab the profile page knows. If the
  // tab is ever renamed, this fails here rather than silently landing the
  // citizen on Account Details (issue #8).
  it('is a tab the profile page renders', () => {
    expect(PROFILE_TABS).toContain(PROFILE_TAB_YELLOW_CARD);
  });
});
