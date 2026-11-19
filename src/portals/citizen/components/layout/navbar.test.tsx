import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Nav from './navbar';

const push = vi.fn();
const logout = vi.fn<() => Promise<void>>();
let authState: { user: { id: string; name: string } | null; isPasswordRecovery: boolean };

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ ...authState, logout, openAuthModal: vi.fn() }),
}));
// The unread badge is fetched for any signed-in session; not under test here.
vi.mock('@/portals/citizen/features/notifications/lib/notifications', () => ({
  notificationService: { getMine: () => Promise.resolve([]) },
  unreadCount: () => 0,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authState = { user: null, isPasswordRecovery: false };
  logout.mockResolvedValue(undefined);
});

describe('Nav', () => {
  it('links to Programs from the Home dropdown', () => {
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'More pages' }));
    const menu = within(screen.getByRole('menu', { name: 'More pages' }));
    expect(menu.getByRole('menuitem', { name: 'Programs' })).toHaveAttribute('href', '/programs');
  });

  it('links to Programs from the mobile panel', () => {
    const { container } = render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const panel = within(container.querySelector<HTMLElement>('#mobile-nav-panel')!);
    expect(panel.getByRole('link', { name: 'Programs' })).toHaveAttribute('href', '/programs');
  });

  // Issue #44: mid-reset, the navbar is stripped to the seal, so it needs its
  // own way out of the recovery session.
  describe('during a password recovery', () => {
    beforeEach(() => {
      authState = { user: { id: 'USER-1', name: 'Juan Dela Cruz' }, isPasswordRecovery: true };
    });

    it('signs out, then takes the citizen home', async () => {
      render(<Nav />);
      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(logout).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/');
      expect(logout.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
    });

    // logout() ends the session locally even when the network call fails;
    // the citizen must not be left on the stripped navbar.
    it('still takes the citizen home when the sign-out fails', async () => {
      logout.mockRejectedValue(new Error('network'));
      render(<Nav />);
      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('offers no "Sign out" outside a recovery', () => {
    authState = { user: { id: 'USER-1', name: 'Juan Dela Cruz' }, isPasswordRecovery: false };
    render(<Nav />);
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });
});
