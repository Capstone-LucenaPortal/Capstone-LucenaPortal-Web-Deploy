import type { CitizenProfileFields } from '@/portals/citizen/features/auth/types';

/** What the sign-up forms (the AuthModal's Sign Up step and /complete-signup)
 * show and submit for Occupation, given the "Are you working in Lucena City?"
 * answer. Occupation only applies to someone working in Lucena, so a "No"
 * blanks and disables the box and submits no occupation.
 *
 * Only the shown and submitted values are blanked. The caller keeps the typed
 * (or pre-filled) `occupation` in state, so switching back to "Yes" brings it
 * back. */
export function occupationField(
  worksInLucena: boolean,
  occupation: string,
): {
  value: string;
  disabled: boolean;
  submit: Required<Pick<CitizenProfileFields, 'occupation' | 'worksInLucena'>>;
} {
  const value = worksInLucena ? occupation : '';
  return { value, disabled: !worksInLucena, submit: { occupation: value, worksInLucena } };
}
