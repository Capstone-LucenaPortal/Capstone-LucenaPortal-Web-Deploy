import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from '@/portals/citizen/features/auth/components/auth-modal';

// Issue #22 (QA CAC-009): the modal is mounted for the life of the page, so
// whatever a citizen typed used to outlive closing it, and Sign In and Sign Up
// shared one email/password. These tests drive the modal the way the layout
// does: a useAuth whose showAuthModal and authMode change between renders.
type Mode = 'login' | 'signup' | 'forgot';

const auth = vi.hoisted(() => {
  let state = { showAuthModal: true, authMode: 'login' as Mode };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  return {
    get: () => state,
    set,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    login: vi.fn(),
    signup: vi.fn(),
    closeAuthModal: () => set({ showAuthModal: false }),
    setAuthMode: (authMode: Mode) => set({ authMode }),
  };
});

vi.mock('@/portals/citizen/features/auth/hooks/use-auth', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAuth: () => {
      const s = useSyncExternalStore(auth.subscribe, auth.get);
      return {
        user: null,
        loading: false,
        login: auth.login,
        signup: auth.signup,
        closeAuthModal: auth.closeAuthModal,
        showAuthModal: s.showAuthModal,
        authMode: s.authMode,
        setAuthMode: auth.setAuthMode,
      };
    },
  };
});

const getBarangays = vi.hoisted(() => vi.fn());
vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: { getBarangays },
}));

const sendPasswordReset = vi.hoisted(() => vi.fn());
vi.mock('@/portals/citizen/features/auth/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/portals/citizen/features/auth/lib/auth')>()),
  authService: { sendPasswordReset },
}));

// No pause between keystrokes: the Sign Up fill types a dozen fields.
const user = userEvent.setup({ delay: null });

const close = () => act(() => auth.set({ showAuthModal: false }));
const open = (authMode: Mode) => act(() => auth.set({ showAuthModal: true, authMode }));

beforeEach(() => {
  vi.clearAllMocks();
  getBarangays.mockResolvedValue([{ code: 'IBD', label: 'Ibabang Dupay' }]);
  sendPasswordReset.mockResolvedValue(undefined);
  auth.set({ showAuthModal: true, authMode: 'login' });
});

describe('AuthModal — closing clears the form', () => {
  it.each([
    ['closeAuthModal', async () => close()],
    ['Escape', () => user.keyboard('{Escape}')],
    ['the close button', () => user.click(screen.getByRole('button', { name: /close dialog/i }))],
    ['a click outside it', () => user.click(screen.getByRole('dialog').parentElement!)],
  ])('clears Sign In when closed with %s', async (_how, closeIt) => {
    render(<AuthModal />);
    await user.type(screen.getByLabelText('Email'), 'juan@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret123!');

    await closeIt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    open('login');

    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('does not bring back an error shown before closing', async () => {
    auth.login.mockRejectedValueOnce(new Error('Invalid email or password.'));
    render(<AuthModal />);
    await user.type(screen.getByLabelText('Email'), 'juan@example.com');
    await user.type(screen.getByLabelText('Password'), 'Wrong123!{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');

    close();
    open('login');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reopens Forgot Password at its first step, not "Check Your Email"', async () => {
    auth.set({ authMode: 'forgot' });
    render(<AuthModal />);
    await user.type(screen.getByLabelText('Email Address'), 'maria@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('heading', { name: 'Check Your Email' })).toBeInTheDocument();

    close();
    open('forgot');

    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveValue('');
  });

  it('reopens Sign Up with every field empty and the terms unticked', async () => {
    auth.set({ authMode: 'signup' });
    render(<AuthModal />);
    await fillSignUp();

    close();
    open('signup');

    expectSignUpEmpty();
  });
});

describe('AuthModal — switching forms clears the form', () => {
  it('does not carry the Sign In email and password into Sign Up', async () => {
    render(<AuthModal />);
    await user.type(screen.getByLabelText('Email'), 'juan@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret123!');

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByLabelText(/^Email Address/)).toHaveValue('');
    expect(screen.getByLabelText(/^Confirm Email Address/)).toHaveValue('');
    expect(screen.getByLabelText(/^Password/)).toHaveValue('');
    expect(screen.getByLabelText(/^Confirm Password/)).toHaveValue('');
  });

  it('does not bring back a Sign In error after a trip to Sign Up and back', async () => {
    auth.login.mockRejectedValueOnce(new Error('Invalid email or password.'));
    render(<AuthModal />);
    await user.type(screen.getByLabelText('Email'), 'juan@example.com');
    await user.type(screen.getByLabelText('Password'), 'Wrong123!{Enter}');
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign up/i }));
    await user.click(screen.getByRole('button', { name: /already have an account/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('empties Sign Up after a trip to Sign In and back', async () => {
    auth.set({ authMode: 'signup' });
    render(<AuthModal />);
    await fillSignUp();

    await user.click(screen.getByRole('button', { name: /already have an account/i }));
    expect(screen.getByLabelText('Email')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expectSignUpEmpty();
  });

  it('starts Forgot Password empty and still names the address it sent to', async () => {
    render(<AuthModal />);
    await user.type(screen.getByLabelText('Email'), 'juan@example.com');
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    const forgotEmail = screen.getByLabelText('Email Address');
    expect(forgotEmail).toHaveValue('');
    await user.type(forgotEmail, 'maria@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('heading', { name: 'Check Your Email' })).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    expect(sendPasswordReset).toHaveBeenCalledWith('maria@example.com');
  });
});

describe('AuthModal — barangay catalog', () => {
  it('loads the barangays once per page, not on every open or switch', async () => {
    render(<AuthModal />);
    await user.click(screen.getByRole('button', { name: /sign up/i }));
    expect(await screen.findByText('Ibabang Dupay')).toBeInTheDocument();
    close();
    open('login');
    open('signup');

    expect(screen.getByText('Ibabang Dupay')).toBeInTheDocument();
    expect(getBarangays).toHaveBeenCalledTimes(1);
  });
});

// One change event per field: typing re-renders the whole Sign Up form on
// every keystroke, which pushed these tests past the 5 s timeout.
const fill = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillSignUp() {
  await screen.findByText('Ibabang Dupay');
  fill(/^First Name/, 'Juan');
  fill(/^Last Name/, 'Dela Cruz');
  fill('Birth month', '3');
  fill('Birth day', '14');
  fill(/^Sex/, 'Male');
  fill(/^Email Address/, 'juan@example.com');
  fill(/^Mobile Number/, '9171234567');
  fill(/^Street/, 'Quezon Ave');
  fill(/^Barangay/, 'IBD');
  fill(/^Password/, 'Secret123!');
  await user.click(screen.getByLabelText(/I agree to the/));
  for (const label of [/^First Name/, /^Email Address/, /^Mobile Number/, /^Street/, /^Password/]) {
    expect(screen.getByLabelText(label)).not.toHaveValue('');
  }
  expect(screen.getByLabelText(/^Barangay/)).toHaveValue('IBD');
  expect(screen.getByLabelText(/I agree to the/)).toBeChecked();
}

function expectSignUpEmpty() {
  for (const label of [/^First Name/, /^Last Name/, /^Email Address/, /^Mobile Number/, /^Street/, /^Password/]) {
    expect(screen.getByLabelText(label)).toHaveValue('');
  }
  for (const label of ['Birth month', 'Birth day', /^Sex/, /^Barangay/]) {
    expect(screen.getByLabelText(label)).toHaveValue('');
  }
  expect(screen.getByLabelText(/I agree to the/)).not.toBeChecked();
}
