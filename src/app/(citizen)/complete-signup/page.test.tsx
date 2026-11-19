import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CompleteSignupPage from '@/app/(citizen)/complete-signup/page';

// The page asks authService who is signed in and whether a profile exists;
// the subject under test is the form it shows when the profile is incomplete.
vi.mock('@/portals/citizen/features/auth/lib/auth', () => ({
  authService: {
    getCurrentUser: () => Promise.resolve({ id: 'u1' }),
    ensureCitizenProfile: () => Promise.resolve('incomplete'),
    getCurrentUserMetadata: () => Promise.resolve({ occupation: 'Nurse' }),
    completeProfile: vi.fn(),
  },
}));

vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: {
    getBarangays: () => Promise.resolve([]),
    getGenders: () => Promise.resolve([]),
  },
}));

describe('CompleteSignupPage', () => {
  // Issue #135, the same as the sign-up modal: "No" sends no occupation, so
  // the disabled box shows empty, and "Yes" brings the earlier text back.
  it('empties the Occupation box while "No" is picked and restores the pre-filled text on "Yes"', async () => {
    render(<CompleteSignupPage />);
    const occupation = await screen.findByDisplayValue('Nurse');

    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    expect(occupation).toBeDisabled();
    expect(occupation).toHaveValue('');

    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(occupation).toBeEnabled();
    expect(occupation).toHaveValue('Nurse');
  });
});
