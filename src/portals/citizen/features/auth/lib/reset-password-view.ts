/**
 * Which panel `/reset-password` shows, and whether it sends the citizen to
 * Profile instead. Kept pure, like `session-policy.ts`, so the rule is
 * unit-tested under the `node` environment; `useResetPasswordState` wires it to
 * `useAuth` and the router.
 *
 * Only the reset link's recovery session may set a password without the
 * current one. Any other signed-in visit is a password change, and that
 * belongs to Profile → Security & Password, which asks for the current
 * password first (issue #16).
 */

export type ResetPasswordState =
  /** The password was updated and the citizen signed out. */
  | 'done'
  /** The citizen chose to leave the reset and is being signed out (#44). */
  | 'cancelling'
  /** Auth is still bootstrapping; the recovery session may yet arrive. */
  | 'waiting'
  /** A session that did not come from the reset link, or not yet. */
  | 'signedInWithoutRecovery'
  /** Auth settled with no session: the link was used, expired, or opened
   *  in a browser without its PKCE code verifier. */
  | 'linkUnusable'
  /** A recovery session: the new-password form. */
  | 'form';

export interface ResetPasswordInput {
  loading: boolean;
  hasUser: boolean;
  isPasswordRecovery: boolean;
  passwordUpdated: boolean;
  /** A "Cancel and sign out" or "Sign out" was pressed during this visit. */
  cancelling: boolean;
  /** The page was opened from the reset link (it carried a `code`). */
  openedFromResetLink: boolean;
}

export interface ResetPasswordView {
  state: ResetPasswordState;
  /** Replace the page with Profile → Security & Password. */
  redirectToSecurity: boolean;
}

/** Precedence: done > cancelling > waiting > signedInWithoutRecovery > linkUnusable > form. */
export function resetPasswordView(input: ResetPasswordInput): ResetPasswordView {
  const signedInWithoutRecovery = !input.loading && input.hasUser && !input.isPasswordRecovery;
  // supabase-js reports the exchanged session before PASSWORD_RECOVERY fires,
  // so a page opened from the link briefly looks signed in without recovery.
  // Leave it on the panel rather than throw away a genuine reset; a used or
  // expired link on a signed-in browser stays there too, with a button to
  // Profile. The redirect is independent of the panel shown, "Password
  // Updated" included.
  const redirectToSecurity = signedInWithoutRecovery && !input.openedFromResetLink;

  // Updating the password signs the citizen out, which would otherwise read as
  // an unusable link.
  if (input.passwordUpdated) return { state: 'done', redirectToSecurity };
  // Cancelling signs out before the page navigates home; that signed-out
  // render must not flash "link unusable" at a deliberate cancel.
  if (input.cancelling) return { state: 'cancelling', redirectToSecurity };
  if (input.loading) return { state: 'waiting', redirectToSecurity };
  if (signedInWithoutRecovery) return { state: 'signedInWithoutRecovery', redirectToSecurity };
  if (!input.hasUser) return { state: 'linkUnusable', redirectToSecurity };
  return { state: 'form', redirectToSecurity };
}
