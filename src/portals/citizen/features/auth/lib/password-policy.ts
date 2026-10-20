/** One policy, one place. The UI copy and the enforcement must never diverge
 * again (the old profile page advertised four rules and enforced one). */
export const PASSWORD_RULES_TEXT = 'At least 8 characters, with at least one letter and one number.';

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[a-zA-Z]/.test(pw)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(pw)) return 'Password must include at least one number.';
  return null;
}
