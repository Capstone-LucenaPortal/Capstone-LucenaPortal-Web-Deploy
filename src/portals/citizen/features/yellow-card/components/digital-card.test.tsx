import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DigitalCard from '@/portals/citizen/features/yellow-card/components/digital-card';
import type { DigitalCardFace } from '@/portals/citizen/features/yellow-card/lib/digital-card';
import type { MyYellowCard, MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';

const CARD_PNG = 'data:image/png;base64,Q0FSRA==';
const renderDigitalCard = vi.fn<(face: DigitalCardFace, link: string) => Promise<string>>();

// jsdom has no canvas. The card art is the renderer's job; the subject here is
// what the Citizen sees and can do with whatever image it returns.
vi.mock('@/portals/citizen/features/yellow-card/lib/render-digital-card', () => ({
  CARD_ASPECT_RATIO: '1011 / 638',
  renderDigitalCard: (face: DigitalCardFace, link: string) => renderDigitalCard(face, link),
}));

const activeCard: MyYellowCard = {
  id: 'CARD-1',
  card_number: 'LC-2026-063813',
  verification_token: 'tok-1',
  status: 'active',
  application_id: 'APP-1',
  holder_name: 'Monaliza Cochangco Panganiban',
  barangay_name: 'Ilayang Iyam',
  valid_from: '2026-10-01',
  expires_at: null,
  revoked_reason: null,
};

const application = {
  id: 'APP-1',
  first_name: 'Monaliza',
  middle_name: 'Cochangco',
  last_name: 'Panganiban',
  suffix: null,
  barangay_name: 'Ilayang Iyam',
  complete_address: '132 Daleon St. Torres Subd.',
} as MyYellowCardApplication;

beforeEach(() => {
  vi.clearAllMocks();
  renderDigitalCard.mockResolvedValue(CARD_PNG);
});

async function showActiveCard() {
  render(<DigitalCard activeCard={activeCard} nonActiveCard={null} application={application} />);
  await screen.findByRole('img', { name: /your digital yellow card/i });
}

describe('DigitalCard', () => {
  it('shows an active card as an image, with the card number as text beside it', async () => {
    await showActiveCard();

    expect(screen.getByRole('img', { name: /your digital yellow card/i })).toHaveAttribute('src', CARD_PNG);
    expect(screen.getByText('LC-2026-063813')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show card' })).toBeInTheDocument();
  });

  it('draws the card from its face and a QR link to this card\'s Verification', async () => {
    await showActiveCard();

    expect(renderDigitalCard).toHaveBeenCalledWith(
      {
        name: 'PANGANIBAN, MONALIZA COCHANGCO',
        cardNumber: 'LC-2026-063813',
        addressLines: ['132 DALEON ST. TORRES SUBD.', 'ILAYANG IYAM'],
      },
      `${window.location.origin}/verify?token=tok-1`,
    );
  });

  it('offers the card as a PNG download named after the card number', async () => {
    await showActiveCard();

    const download = screen.getByRole('link', { name: /download card/i });
    expect(download).toHaveAttribute('href', CARD_PNG);
    expect(download).toHaveAttribute('download', 'yellow-card-LC-2026-063813.png');
  });

  it('opens the card full screen, and Escape closes it and gives focus back to Show card', async () => {
    const user = userEvent.setup();
    await showActiveCard();
    const showCard = screen.getByRole('button', { name: 'Show card' });

    await user.click(showCard);
    const dialog = screen.getByRole('dialog', { name: /your digital yellow card/i });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(showCard).toHaveFocus();
  });

  it('closes the full-screen card on a tap anywhere on it', async () => {
    const user = userEvent.setup();
    await showActiveCard();
    const showCard = screen.getByRole('button', { name: 'Show card' });

    await user.click(showCard);
    await user.click(screen.getByRole('img', { name: /full screen/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(showCard).toHaveFocus();
  });

  it('falls back to the card number when the card cannot be drawn', async () => {
    renderDigitalCard.mockRejectedValue(new Error('no canvas'));
    render(<DigitalCard activeCard={activeCard} nonActiveCard={null} application={application} />);

    expect(await screen.findByText(/could not be drawn on this device/i)).toBeInTheDocument();
    expect(screen.getByText('LC-2026-063813')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show card' })).not.toBeInTheDocument();
  });

  it.each([
    ['revoked', 'This card has been revoked'],
    ['superseded', 'This card has been superseded'],
  ])('shows a %s card as a notice with no card to present', async (status, notice) => {
    render(
      <DigitalCard
        activeCard={null}
        nonActiveCard={{ ...activeCard, status }}
        application={application}
      />,
    );

    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show card' })).not.toBeInTheDocument();
    await waitFor(() => expect(renderDigitalCard).not.toHaveBeenCalled());
  });

  it('tells a Citizen with no card yet that it will appear once approved', () => {
    render(<DigitalCard activeCard={null} nonActiveCard={null} application={null} />);

    expect(screen.getByText('Your digital Yellow Card will appear here')).toBeInTheDocument();
    expect(renderDigitalCard).not.toHaveBeenCalled();
  });
});
