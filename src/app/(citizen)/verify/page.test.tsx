import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerifyPage from '@/app/(citizen)/verify/page';
import type { VerifiedCard } from '@/portals/citizen/features/yellow-card/types';
import type { VerifyCardResult } from '@/portals/citizen/features/yellow-card/lib/yellow-card';

const verifyCard = vi.fn<(token: string) => Promise<VerifyCardResult>>();
let searchParams = new URLSearchParams();

// The subject is what a Verifier sees for a given RPC answer, so the RPC call
// is the stub boundary — the lib's own tests cover which RPC answers mean
// not-found and which mean unavailable.
vi.mock('@/portals/citizen/features/yellow-card/lib/yellow-card', () => ({
  verifyCard: (token: string) => verifyCard(token),
}));

// No App Router is mounted under test (see the reset-password page test).
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

const ID_CHECK = /check that this name matches the name on the card and on the holder's government id/i;

/** Opens the page on `token`, whose check resolves `answer` (a card, or no card). */
function opened(token: string, answer: VerifiedCard | null | VerifyCardResult) {
  searchParams = new URLSearchParams({ token });
  verifyCard.mockResolvedValue(
    answer === null ? { kind: 'not-found' } : 'kind' in answer ? answer : { kind: 'found', card: answer },
  );
}

const COULD_NOT_CHECK = /couldn.t check this card/i;
const ANY_VERDICT = /not recognised|do not accept|valid|revoked|superseded/i;

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe('VerifyPage', () => {
  it('shows a valid card as VALID with the holder name and the ID-check line', async () => {
    opened('tok-1', { holder_name: 'PANGANIBAN, MONALIZA COCHANGCO', status: 'active' });
    render(<VerifyPage />);

    expect(await screen.findByRole('heading', { name: 'VALID' })).toBeInTheDocument();
    expect(screen.getByText('PANGANIBAN, MONALIZA COCHANGCO')).toBeInTheDocument();
    expect(screen.getByText(ID_CHECK)).toBeInTheDocument();
    expect(verifyCard).toHaveBeenCalledWith('tok-1');
  });

  // The RPC builds the name as the Digital Card prints it (DB#26), so the page
  // must not touch it: any re-casing or reordering here would be a second rule
  // that can drift from the card. A mixed-case name proves nothing re-cases it.
  // jsdom loads no stylesheet, so the style walk sees inline styles and
  // Tailwind case classes only, not a rule in globals.css.
  it('shows the holder name exactly as the RPC returns it', async () => {
    const asReturned = 'de la Cruz, María Santos Jr.';
    opened('tok-8', { holder_name: asReturned, status: 'active' });
    render(<VerifyPage />);

    const name = await screen.findByText(asReturned);
    expect(name.textContent).toBe(asReturned);
    for (let el: HTMLElement | null = name; el; el = el.parentElement) {
      expect(getComputedStyle(el).textTransform).toMatch(/^(none)?$/);
      expect(el.className).not.toMatch(/\b(uppercase|lowercase|capitalize)\b/);
    }
  });

  it.each([
    ['revoked', 'REVOKED', /do not accept it/i],
    ['superseded', 'SUPERSEDED', /ask the holder for their current card/i],
  ])('shows a %s card with its verdict and name but no ID-check line', async (status, word, note) => {
    opened('tok-2', { holder_name: 'DELA CRUZ, JUAN SANTOS JR.', status });
    render(<VerifyPage />);

    expect(await screen.findByRole('heading', { name: word })).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByText('DELA CRUZ, JUAN SANTOS JR.')).toBeInTheDocument();
    expect(screen.queryByText(ID_CHECK)).not.toBeInTheDocument();
  });

  // DB l87 (SCRUM-258) narrowed the RPC to these two columns, but the page
  // shipped first, against the five-column RPC. Whatever the RPC returns, only
  // the verdict and the name reach the screen.
  it('shows nothing beyond the verdict and name, even if the RPC returns more', async () => {
    const wideRow = {
      holder_name: 'DELA CRUZ, JUAN SANTOS JR.',
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
    opened('tok-4', { holder_name: 'DELA CRUZ, JUAN SANTOS JR.', status: 'suspended' });
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

  // A failed request says nothing about the card, so it gets no verdict: a
  // Verifier on a weak signal must not be told to turn a genuine holder away
  // (issue #52).
  it("tells a Verifier a failed check couldn't be done, with Retry and no verdict", async () => {
    opened('tok-5', { kind: 'unavailable' });
    render(<VerifyPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(COULD_NOT_CHECK);
    expect(alert).toHaveTextContent(/check your connection and try again/i);
    expect(alert).not.toHaveTextContent(ANY_VERDICT);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it("gives an unexpected throw the same couldn't-check answer, not a verdict", async () => {
    opened('tok-6', null);
    verifyCard.mockRejectedValue(new Error('boom'));
    render(<VerifyPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(COULD_NOT_CHECK);
    expect(alert).not.toHaveTextContent(ANY_VERDICT);
  });

  it('checks the same code again on Retry and shows the verdict once it gets through', async () => {
    opened('tok-7', { holder_name: 'DELA CRUZ, JUAN SANTOS JR.', status: 'active' });
    verifyCard.mockResolvedValueOnce({ kind: 'unavailable' });
    render(<VerifyPage />);

    await userEvent.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: 'VALID' })).toBeInTheDocument();
    expect(screen.queryByText(COULD_NOT_CHECK)).not.toBeInTheDocument();
    expect(verifyCard).toHaveBeenCalledTimes(2);
    expect(verifyCard).toHaveBeenNthCalledWith(2, 'tok-7');
  });

  it('tells a Verifier with no code to use their camera app, with no input field', () => {
    render(<VerifyPage />);

    expect(screen.getByText(/open your phone's camera app and point it at the qr code/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(verifyCard).not.toHaveBeenCalled();
  });
});
