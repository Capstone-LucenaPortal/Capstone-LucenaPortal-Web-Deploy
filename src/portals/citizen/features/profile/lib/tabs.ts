/**
 * The tabs on `/profile`, and the `?tab=` contract other pages link through.
 *
 * This exists so a deep link is not a bare string agreed in two places. The
 * Yellow Card page sends an approved applicant straight to their card
 * (issue #8), and if the tab identifier were written out at both ends a rename
 * would silently land them on Account Details instead — no error, just the
 * wrong tab.
 */

export const PROFILE_TABS = ['account', 'security', 'yellowcard', 'privacy'] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

/** The tab that changes the password, behind the current one. */
export const PROFILE_TAB_SECURITY: ProfileTab = 'security';

/** The tab holding the digital card and its QR code. */
export const PROFILE_TAB_YELLOW_CARD: ProfileTab = 'yellowcard';

/** The tab a `?tab=` value opens, defaulting to Account Details.
 *
 * A stale, typo'd or hand-edited link resolves to a real tab rather than
 * leaving every panel unrendered, which is what comparing an unknown string
 * against each `activeTab` would do. */
export function profileTabFromQuery(value: string | null | undefined): ProfileTab {
  return PROFILE_TABS.includes(value as ProfileTab) ? (value as ProfileTab) : 'account';
}
