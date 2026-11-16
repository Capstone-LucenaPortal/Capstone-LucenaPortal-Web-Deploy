import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import HomePage from '@/app/(citizen)/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: null, openAuthModal: vi.fn() }),
}));
vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: {
    getEmergencyHotlines: () => Promise.resolve([]),
    getSiteInfo: () => Promise.resolve(null),
  },
}));

const TOP_SLIDES = 4;
const LCC_SLIDES = 5;

/** Settles the page's catalogs read, so no state update lands after the test. */
async function renderHome() {
  await act(async () => {
    render(<HomePage />);
  });
}

const dots = (total: number) =>
  screen.getAllByRole('button', { name: new RegExp(`^Go to slide \\d+ of ${total}$`) });

/** The name of every dot on one carousel that says it's the current one. */
const currentDots = (total: number) =>
  dots(total)
    .filter((dot) => dot.getAttribute('aria-current') === 'true')
    .map((dot) => dot.getAttribute('aria-label'));

const buttonsWithAriaCurrent = () =>
  screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-current'));

const arrow = (name: 'Previous slide' | 'Next slide', carousel: 'top' | 'lcc') =>
  screen.getAllByRole('button', { name })[carousel === 'top' ? 0 : 1];

describe('Home page carousels', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('names both arrows of each carousel for what they do', async () => {
    await renderHome();
    expect(screen.getAllByRole('button', { name: 'Previous slide' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Next slide' })).toHaveLength(2);
  });

  it('still shows the arrow characters on the arrows', async () => {
    await renderHome();
    expect(arrow('Previous slide', 'top')).toHaveTextContent('←');
    expect(arrow('Next slide', 'top')).toHaveTextContent('→');
    expect(arrow('Previous slide', 'lcc')).toHaveTextContent('←');
    expect(arrow('Next slide', 'lcc')).toHaveTextContent('→');
  });

  it.each([
    ['top', TOP_SLIDES],
    ['Convention Center', LCC_SLIDES],
  ])('names each dot of the %s carousel by its slide and the slide count', async (_carousel, total) => {
    await renderHome();
    expect(dots(total)).toHaveLength(total);
    for (let n = 1; n <= total; n++) {
      expect(screen.getByRole('button', { name: `Go to slide ${n} of ${total}` })).toBeInTheDocument();
    }
  });

  it('leaves no button on the page with an empty name or only an arrow for a name', async () => {
    await renderHome();
    expect(screen.queryAllByRole('button', { name: /^\s*[←→]?\s*$/ })).toEqual([]);
  });

  it('marks only the first dot of each carousel as current to begin with', async () => {
    await renderHome();
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 4']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 1 of 5']);
    expect(buttonsWithAriaCurrent()).toHaveLength(2);
  });

  it('moves the current dot with the arrows, on that carousel only', async () => {
    await renderHome();

    fireEvent.click(arrow('Next slide', 'top'));
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 4']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 1 of 5']);

    fireEvent.click(arrow('Previous slide', 'lcc'));
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 5 of 5']);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 4']);
    expect(buttonsWithAriaCurrent()).toHaveLength(2);
  });

  it('moves the current dot when a dot is used', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3 of 4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 4 of 5' }));
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 3 of 4']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 4 of 5']);
  });

  it.each([
    [2, 'City Programs', '/hero-programs.jpg'],
    [3, 'Lucena News', '/hero-news.jpg'],
  ])('shows slide %i, %s, over its own photo', async (n, title, image) => {
    await renderHome();
    fireEvent.click(screen.getByRole('button', { name: `Go to slide ${n} of ${TOP_SLIDES}` }));
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    const hero = screen.getByRole('heading', { level: 1, name: title }).closest('section')!;
    const background = hero.querySelector<HTMLElement>('section > div > div')!;
    expect(background.style.background).toContain(image);
  });

  it('moves the current dot when a Convention Center image is clicked', async () => {
    await renderHome();
    fireEvent.click(screen.getByText('Sports Arena'));
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 2 of 5']);
  });

  it('moves the current dot when the timer changes the slide', async () => {
    vi.useFakeTimers();
    await renderHome();

    // The Convention Center carousel turns every 4 seconds, the top one every 5.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 2 of 5']);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 4']);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 4']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 2 of 5']);
  });
});
