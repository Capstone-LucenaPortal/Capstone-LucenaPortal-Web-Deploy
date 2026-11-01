import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from '@/portals/citizen/features/auth/components/auth-modal';
import { AuthError } from '@/portals/citizen/features/auth/lib/auth';

const login = vi.fn();
const signup = vi.fn();
const closeAuthModal = vi.fn();
const setAuthMode = vi.fn();
let mode: 'login' | 'signup' | 'forgot' = 'login';

// The provider itself talks to authService and Supabase on mount; the subject
// under test here is the markup, so the context is stubbed at the hook.
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isPasswordRecovery: false,
    idleSignOutNotice: false,
    dismissIdleNotice: vi.fn(),
    setUser: vi.fn(),
    login,
    signup,
    logout: vi.fn(),
    openAuthModal: vi.fn(),
    closeAuthModal,
    showAuthModal: true,
    authMode: mode,
    setAuthMode,
  }),
}));

// Barangays come from the network; one is enough to fill the form in.
vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: { getBarangays: () => Promise.resolve([{ code: 'bocohan', label: 'Bocohan' }]) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mode = 'login';
});

describe('AuthModal — sign in', () => {
  // The regression this pins: every <label> lacked htmlFor and every input
  // lacked a matching id, so a screen reader announced "edit text" with no
  // name for every field in the most-used form on the site. getByLabelText
  // only resolves once that association is real.
  it('exposes both fields by their visible label', () => {
    render(<AuthModal />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('is an accessible dialog named by its heading', () => {
    render(<AuthModal />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Sign In');
  });

  it('carries the autofill hints a password manager needs', () => {
    render(<AuthModal />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  // Every form in this app used to be a div of inputs with an onClick button,
  // which silently broke the commonest way people submit a login form.
  it('submits on Enter from within a field', async () => {
    render(<AuthModal />);
    await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123!{Enter}');
    expect(login).toHaveBeenCalledWith('juan@example.com', 'Password123!');
  });

  it('closes on Escape and from the close button', async () => {
    render(<AuthModal />);
    await userEvent.keyboard('{Escape}');
    expect(closeAuthModal).toHaveBeenCalled();

    closeAuthModal.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(closeAuthModal).toHaveBeenCalled();
  });
});

describe('AuthModal — sign up', () => {
  beforeEach(() => {
    mode = 'signup';
  });

  it('names every field a citizen has to fill in', async () => {
    render(<AuthModal />);
    for (const label of [
      /^First Name/,
      /^Last Name/,
      /^Email Address/,
      /^Confirm Email Address/,
      /^Mobile Number/,
      /^Street/,
      /^Barangay/,
      /^Password/,
      /^Confirm Password/,
      /^Sex/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  // Three selects cannot share one <label>; a fieldset/legend names the group
  // and each control carries its own visually-hidden label.
  it('names each part of the birth-date trio separately', () => {
    render(<AuthModal />);
    expect(screen.getByLabelText('Birth month')).toBeInTheDocument();
    expect(screen.getByLabelText('Birth day')).toBeInTheDocument();
    expect(screen.getByLabelText('Birth year')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Birth Date/ })).toBeInTheDocument();
  });

  it('marks required fields to assistive tech, not only with a visual asterisk', () => {
    render(<AuthModal />);
    expect(screen.getByLabelText(/^First Name/)).toBeRequired();
    expect(screen.getByLabelText(/^Mobile Number/)).toBeRequired();
    expect(screen.getByLabelText(/^Barangay/)).toBeRequired();
  });

  it('asks the browser for a new password, never the saved one', () => {
    render(<AuthModal />);
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('autocomplete', 'new-password');
    // Autofilling both email fields would defeat the point of asking twice.
    expect(screen.getByLabelText(/^Confirm Email Address/)).toHaveAttribute('autocomplete', 'off');
  });

  it('does not submit the form when the password-visibility toggle is pressed', async () => {
    render(<AuthModal />);
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(signup).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('tells the citizen a responder may call the number on file', () => {
    render(<AuthModal />);
    expect(screen.getByText(/Responders may call this number/i)).toBeInTheDocument();
  });
});

describe('AuthModal — sign up submit', { timeout: 20_000 }, () => {
  beforeEach(() => {
    mode = 'signup';
  });

  /** Fill in every required field with valid values, then press Create Account.
   * Values are set directly rather than typed: what is under test is what the
   * modal does after the submit, and typing into this many fields is slow.
   * The same goes for role queries: on a form this size each one costs. */
  const fillAndSubmit = async () => {
    render(<AuthModal />);
    await screen.findByText('Bocohan');
    const set = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });
    set(screen.getByLabelText(/^First Name/), 'Juan');
    set(screen.getByLabelText(/^Last Name/), 'Dela Cruz');
    set(screen.getByLabelText('Birth month'), '1');
    set(screen.getByLabelText('Birth day'), '15');
    set(screen.getByLabelText('Birth year'), '1990');
    set(screen.getByLabelText(/^Sex/), 'Male');
    set(screen.getByLabelText(/^Email Address/), 'juan@example.com');
    set(screen.getByLabelText(/^Confirm Email Address/), 'juan@example.com');
    set(screen.getByLabelText(/^Mobile Number/), '9123456789');
    set(screen.getByLabelText(/^Street/), 'Rizal Street');
    set(screen.getByLabelText(/^Barangay/), 'bocohan');
    set(screen.getByLabelText(/^Password/), 'Password123!');
    set(screen.getByLabelText(/^Confirm Password/), 'Password123!');
    fireEvent.click(screen.getByLabelText(/^I agree to the/));
    fireEvent.click(screen.getByText('Create Account'));
  };

  // Issue #65. With email confirmation on, the sign-up succeeds without a
  // session. The success sentence used to land in the red error line under a
  // still-filled form, so citizens read it as a failure and submitted again.
  it('swaps the form for a Check Your Email panel when the email awaits confirmation', async () => {
    signup.mockResolvedValueOnce('confirm-email');
    await fillAndSubmit();
    expect(signup).toHaveBeenCalledWith(expect.objectContaining({ email: 'juan@example.com' }));
    expect(await screen.findByRole('heading', { name: 'Check Your Email' })).toBeInTheDocument();
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Account' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to Sign In' }));
    expect(setAuthMode).toHaveBeenCalledWith('login');
  });

  it('still shows a real sign-up failure in the error line', async () => {
    signup.mockRejectedValueOnce(new AuthError('An account with this email already exists. Please sign in instead.'));
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists');
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });
});
