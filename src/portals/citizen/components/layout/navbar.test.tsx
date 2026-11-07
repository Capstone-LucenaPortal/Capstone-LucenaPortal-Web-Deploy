import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Nav from './navbar';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: null, logout: vi.fn(), openAuthModal: vi.fn(), isPasswordRecovery: false }),
}));

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
});
