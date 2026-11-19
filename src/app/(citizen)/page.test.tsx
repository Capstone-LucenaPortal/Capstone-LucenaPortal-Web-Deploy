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

const TOP_SLIDES = 3;
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
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 1 of 5']);
    expect(buttonsWithAriaCurrent()).toHaveLength(2);
  });

  it('moves the current dot with the arrows, on that carousel only', async () => {
    await renderHome();

    fireEvent.click(arrow('Next slide', 'top'));
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 1 of 5']);

    fireEvent.click(arrow('Previous slide', 'lcc'));
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 5 of 5']);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
    expect(buttonsWithAriaCurrent()).toHaveLength(2);
  });

  it('moves the current dot when a dot is used', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3 of 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 4 of 5' }));
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 3 of 3']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 4 of 5']);
  });

  it.each([
    [2, 'City Programs', '/hero-programs.jpg'],
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
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 2 of 5']);
  });
});

/** The pause/play button of one carousel, whichever name it has now. */
const playPause = (carousel: 'top' | 'lcc') =>
  screen.getAllByRole('button', { name: /^(Pause|Play) slideshow$/ })[carousel === 'top' ? 0 : 1];

/** Focus as a keyboard user does: a Tab, then focus lands on the element. */
const tabTo = (el: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('Home page carousels: pausing', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('gives each carousel a button that pauses it, then plays it again', async () => {
    vi.useFakeTimers();
    await renderHome();
    expect(screen.getAllByRole('button', { name: 'Pause slideshow' })).toHaveLength(2);

    fireEvent.click(playPause('top'));
    expect(playPause('top')).toHaveAccessibleName('Play slideshow');
    advance(20000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);

    fireEvent.click(playPause('top'));
    expect(playPause('top')).toHaveAccessibleName('Pause slideshow');
    advance(5000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
  });

  it('pauses only the carousel whose button was pressed', async () => {
    vi.useFakeTimers();
    await renderHome();
    fireEvent.click(playPause('lcc'));
    advance(5000);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 1 of 5']);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
  });

  it('holds still while the pointer is over it, and moves on once it leaves', async () => {
    vi.useFakeTimers();
    await renderHome();
    fireEvent.pointerEnter(arrow('Next slide', 'top'));
    advance(12000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);
    // Hovering the top carousel leaves the other one moving.
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 4 of 5']);

    fireEvent.pointerLeave(arrow('Next slide', 'top'));
    advance(5000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
  });

  it('holds still while keyboard focus is inside it, and moves on once focus leaves', async () => {
    vi.useFakeTimers();
    await renderHome();
    tabTo(arrow('Previous slide', 'lcc'));
    advance(4000);
    // Focus moving within the carousel keeps it still.
    tabTo(screen.getByRole('button', { name: 'Go to slide 3 of 5' }));
    advance(8000);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 1 of 5']);

    act(() => (document.activeElement as HTMLElement).blur());
    advance(4000);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 2 of 5']);
  });

  it('moves on after a mouse click once the pointer leaves, though the click left focus inside', async () => {
    vi.useFakeTimers();
    await renderHome();
    const next = arrow('Next slide', 'lcc');
    // A mouse click focuses the button in Chrome and Firefox.
    fireEvent.pointerEnter(next);
    fireEvent.pointerDown(next);
    fireEvent.mouseDown(next);
    act(() => next.focus());
    fireEvent.click(next);
    fireEvent.pointerLeave(next);
    expect(document.activeElement).toBe(next);

    advance(4000);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 3 of 5']);
  });

  it("holds the top carousel still while its call-to-action button has focus", async () => {
    vi.useFakeTimers();
    await renderHome();
    tabTo(screen.getByRole('button', { name: 'Learn More' }));
    advance(12000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);
  });

  it('keeps the top carousel moving while the Live ticker under it is in use', async () => {
    vi.useFakeTimers();
    await renderHome();
    const ticker = screen.getByRole('button', { name: /View All/ });
    fireEvent.pointerEnter(ticker);
    tabTo(ticker);
    advance(5000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
  });

  it('stays paused by its button after the pointer and focus leave', async () => {
    vi.useFakeTimers();
    await renderHome();
    fireEvent.pointerEnter(playPause('top'));
    tabTo(playPause('top'));
    fireEvent.click(playPause('top'));

    fireEvent.pointerLeave(playPause('top'));
    act(() => playPause('top').blur());
    advance(20000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);
    expect(playPause('top')).toHaveAccessibleName('Play slideshow');
  });

  // The pointer leaves after each click so only the countdown is under test.
  const clickAndLeave = (el: HTMLElement) => {
    fireEvent.click(el);
    fireEvent.pointerLeave(el);
  };

  it('waits a full interval after an arrow is used before moving on', async () => {
    vi.useFakeTimers();
    await renderHome();
    advance(4000);
    clickAndLeave(arrow('Next slide', 'top'));
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);

    advance(1000); // t = 5 s, the old schedule
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 2 of 3']);
    advance(4000); // t = 9 s, 5 s after the click
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 3 of 3']);
  });

  it('waits a full interval after a dot is used before moving on', async () => {
    vi.useFakeTimers();
    await renderHome();
    advance(3000);
    clickAndLeave(screen.getByRole('button', { name: 'Go to slide 4 of 5' }));

    advance(3999);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 4 of 5']);
    advance(1);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 5 of 5']);
  });

  it('waits a full interval after a Convention Center side image is clicked', async () => {
    vi.useFakeTimers();
    await renderHome();
    advance(3000);
    clickAndLeave(screen.getByText('Sports Arena'));

    advance(3999);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 2 of 5']);
    advance(1);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 3 of 5']);
  });

  it('starts both carousels paused when the device asks for reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.useFakeTimers();
    await renderHome();
    expect(screen.getAllByRole('button', { name: 'Play slideshow' })).toHaveLength(2);
    advance(20000);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 1 of 5']);

    fireEvent.click(playPause('lcc'));
    expect(playPause('lcc')).toHaveAccessibleName('Pause slideshow');
    advance(4000);
    expect(currentDots(LCC_SLIDES)).toEqual(['Go to slide 2 of 5']);
    expect(currentDots(TOP_SLIDES)).toEqual(['Go to slide 1 of 3']);
  });
});

const LCC_VENUES = ['The Atrium', 'Sports Arena', 'Full Facility', 'Conference Rooms', 'Event Spaces'];

/** A venue's name-and-caption overlay, and the slide card it sits on. */
const venueOverlay = (venue: string) => screen.getByText(venue).parentElement!;
const venueCard = (venue: string) => venueOverlay(venue).parentElement!;

/** The venues whose name and caption can be seen now: their overlay is opaque. */
const visibleVenues = () => LCC_VENUES.filter((venue) => venueOverlay(venue).style.opacity === '1');

describe('Home page carousels: Convention Center names', () => {
  it('shows no venue name to begin with', async () => {
    await renderHome();
    expect(visibleVenues()).toEqual([]);
  });

  it("shows the centre slide's name while keyboard focus is on an arrow", async () => {
    await renderHome();
    tabTo(arrow('Next slide', 'lcc'));
    expect(visibleVenues()).toEqual(['The Atrium']);
  });

  it("shows the centre slide's name while keyboard focus is on a dot", async () => {
    await renderHome();
    tabTo(screen.getByRole('button', { name: 'Go to slide 1 of 5' }));
    expect(visibleVenues()).toEqual(['The Atrium']);
  });

  it('moves the name to the new centre slide when the focused arrow is pressed', async () => {
    await renderHome();
    tabTo(arrow('Next slide', 'lcc'));
    fireEvent.click(arrow('Next slide', 'lcc'));
    expect(visibleVenues()).toEqual(['Sports Arena']);
  });

  it('moves the name to the slide a focused dot picks', async () => {
    await renderHome();
    const dot = screen.getByRole('button', { name: 'Go to slide 4 of 5' });
    tabTo(dot);
    fireEvent.click(dot);
    expect(visibleVenues()).toEqual(['Conference Rooms']);
  });

  it('hides the name again once focus moves out of the carousel', async () => {
    await renderHome();
    tabTo(arrow('Next slide', 'lcc'));
    tabTo(arrow('Next slide', 'top'));
    expect(visibleVenues()).toEqual([]);
  });

  it('shows no venue name while focus is on the top carousel', async () => {
    await renderHome();
    tabTo(arrow('Next slide', 'top'));
    tabTo(screen.getByRole('button', { name: 'Learn More' }));
    expect(visibleVenues()).toEqual([]);
  });

  it("still shows a side slide's name on hover, and hides it when the mouse leaves", async () => {
    await renderHome();
    const arena = venueCard('Sports Arena');
    fireEvent.mouseEnter(arena);
    expect(visibleVenues()).toEqual(['Sports Arena']);
    fireEvent.mouseLeave(arena);
    expect(visibleVenues()).toEqual([]);
  });

  it('shows both the hovered side slide and the centre slide while focus is inside', async () => {
    await renderHome();
    tabTo(arrow('Previous slide', 'lcc'));
    const arena = venueCard('Sports Arena');
    fireEvent.mouseEnter(arena);
    expect(visibleVenues()).toEqual(['The Atrium', 'Sports Arena']);
    fireEvent.mouseLeave(arena);
    expect(visibleVenues()).toEqual(['The Atrium']);
  });

  it('adds no tab stop or role to the slides', async () => {
    await renderHome();
    for (const venue of LCC_VENUES) {
      expect(screen.getByText(venue).closest('[tabindex], [role]')).toBeNull();
    }
    // The carousel's only stops: two arrows, five dots and pause/play.
    const carousel = venueCard('The Atrium').closest('section')!;
    const stops = carousel.querySelectorAll('button, a[href], input, select, textarea, [tabindex]');
    expect(stops).toHaveLength(2 + LCC_SLIDES + 1);
  });
});
