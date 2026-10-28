import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerifyPage from '@/app/(citizen)/verify/page';
import type { VerifiedCard } from '@/portals/citizen/features/yellow-card/types';

const verifyCard = vi.fn<(token: string) => Promise<VerifiedCard | null>>();
let searchParams = new URLSearchParams();

// The subject is what a Verifier sees for a given RPC answer, so the RPC call
// is the stub boundary — the lib's own tests cover how it collapses failures.
vi.mock('@/portals/citizen/features/yellow-card/lib/yellow-card', () => ({
  verifyCard: (token: string) => verifyCard(token),
}));

// No App Router is mounted under test (see the reset-password page test).
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

const ID_CHECK = /check that this name matches the name on the card and on the holder's government id/i;

function opened(token: string, card: VerifiedCard | null) {
  searchParams = new URLSearchParams({ token });
  verifyCard.mockResolvedValue(card);
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe('VerifyPage', () => {
  it('shows a valid card as VALID with the holder name and the ID-check line', async () => {
    opened('tok-1', { holder_name: 'Monaliza Cochangco Panganiban', status: 'active' });
    render(<VerifyPage />);

    expect(await screen.findByRole('heading', { name: 'VALID' })).toBeInTheDocument();
    expect(screen.getByText('Monaliza Cochangco Panganiban')).toBeInTheDocument();
    expect(screen.getByText(ID_CHECK)).toBeInTheDocument();
    expect(verifyCard).toHaveBeenCalledWith('tok-1');
  });

  it.each([
    ['revoked', 'REVOKED', /do not accept it/i],
    ['superseded', 'SUPERSEDED', /ask the holder for their current card/i],
  ])('shows a %s card with its verdict and name but no ID-check line', async (status, word, note) => {
    opened('tok-2', { holder_name: 'Juan Dela Cruz', status });
    render(<VerifyPage />);

    expect(await screen.findByRole('heading', { name: word })).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.queryByText(ID_CHECK)).not.toBeInTheDocument();
  });

  // Until the DB narrowing (SCRUM-258) lands, the live RPC still returns the
  // three dropped columns. They must not reach the screen either way.
  it('shows nothing beyond the verdict and name, even if the RPC returns more', async () => {
    const wideRow = {
      holder_name: 'Juan Dela Cruz',
      status: 'active',
      barangay_name: 'Ilayang Iyam',
      card_number: 'LC-2026-000123',
      valid_from: '2026-10-01',
    } as VerifiedCard;
    opened('tok-3', wideRow);
    render(<VerifyPage />);

    await screen.findByRole('heading', { name: 'VALID' });
    expect(screen.queryByText(/ilayang iyam/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LC-2026-000123/)).not.toBeInTheDocument();
    expect(screen.queryByText(/barangay|card number|valid from/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });

  it('gives a status it does not know a cautious answer and no ID-check line', async () => {
    opened('tok-4', { holder_name: 'Juan Dela Cruz', status: 'suspended' });
    render(<VerifyPage />);

    expect(await screen.findByRole('heading', { name: 'SUSPENDED' })).toBeInTheDocument();
    expect(screen.getByText(/before accepting this card/i)).toBeInTheDocument();
    expect(screen.queryByText(ID_CHECK)).not.toBeInTheDocument();
  });

  it.each([
    ['an unknown', '00000000-0000-0000-0000-000000000000'],
    ['a malformed', 'not-a-uuid'],
  ])('gives %s code the same "not recognised" answer', async (_kind, token) => {
    opened(token, null);
    render(<VerifyPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This code is not recognised');
    expect(alert).toHaveTextContent(/do not accept the card/i);
  });

  it('tells a Verifier with no code to use their camera app, with no input field', () => {
    render(<VerifyPage />);

    expect(screen.getByText(/open your phone's camera app and point it at the qr code/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(verifyCard).not.toHaveBeenCalled();
  });
});
