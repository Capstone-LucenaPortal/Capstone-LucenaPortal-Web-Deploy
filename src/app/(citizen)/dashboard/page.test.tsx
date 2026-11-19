import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '@/app/(citizen)/dashboard/page';
import { getMyIncidents } from '@/portals/citizen/features/incidents/lib/incidents';
import type { MyIncident } from '@/portals/citizen/features/incidents/types';
import { getMyBookings } from '@/portals/citizen/features/booking/lib/booking';
import type { MyBooking } from '@/portals/citizen/features/booking/types';
import { yellowCardService } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import type { MyYellowCard, MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';
import { notificationService } from '@/portals/citizen/features/notifications/lib/notifications';

// The provider itself talks to authService and Supabase on mount; the subject
// under test is what the page renders once a citizen is signed in.
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'citizen-1', name: 'Juan Dela Cruz' },
    loading: false,
    isPasswordRecovery: false,
    openAuthModal: vi.fn(),
  }),
}));

// No App Router is mounted under test; see the Citizen CLAUDE.md Testing section.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

// These two reads are plain module functions rather than methods on a service
// object, so they are replaced at the module rather than spied on.
vi.mock('@/portals/citizen/features/incidents/lib/incidents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/portals/citizen/features/incidents/lib/incidents')>()),
  getMyIncidents: vi.fn(),
}));
vi.mock('@/portals/citizen/features/booking/lib/booking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/portals/citizen/features/booking/lib/booking')>()),
  getMyBookings: vi.fn(),
}));

const YELLOW_CARD_ERROR = 'Could not load your Yellow Card information right now. Please try again later.';
const INCIDENTS_ERROR = 'Could not load your incident reports right now. Please try again later.';
const BOOKINGS_ERROR = 'Could not load booking information right now. Please try again later.';

const application = {
  id: 'app-1',
  reference_number: 'YC-2026-000110',
  status: 'pending',
  submitted_at: '2026-11-10T02:00:00Z',
  due_at: '2026-11-20T02:00:00Z',
  current_reason: null,
} as unknown as MyYellowCardApplication;

const activeCard = {
  id: 'card-1',
  card_number: 'LC-2026-000110',
  status: 'active',
  application_id: 'app-1',
  valid_from: '2026-11-12T02:00:00Z',
} as unknown as MyYellowCard;

const incident = {
  id: 'inc-1',
  reference_number: 'INC-2026-000110',
  type_label: 'Flooding',
  status: 'submitted',
  address: '12 Rizal St',
  barangay_name: 'Barangay Uno',
  assigned_department_label: null,
  original_reference: null,
  submitted_at: '2026-11-11T02:00:00Z',
  sla_due_at: null,
} as unknown as MyIncident;

const booking = {
  id: 'bk-1',
  reference_number: 'BK-2026-000110',
  status: 'pending',
  event_title: 'Barangay Assembly',
  venue_label: 'Main Hall',
  event_date: '2026-12-01',
  start_time: '09:00',
  submitted_at: '2026-11-12T02:00:00Z',
  total_fee: null,
} as unknown as MyBooking;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyIncidents).mockResolvedValue([incident]);
  vi.mocked(getMyBookings).mockResolvedValue([booking]);
  vi.spyOn(yellowCardService, 'getMyApplications').mockResolvedValue([application]);
  vi.spyOn(yellowCardService, 'getMyCards').mockResolvedValue([]);
  vi.spyOn(notificationService, 'getMine').mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderDashboard() {
  render(<DashboardPage />);
  await screen.findByRole('heading', { name: 'My Dashboard' });
}

/** A summary tile, found by its caption. */
function tile(caption: string): HTMLElement {
  return screen.getByText(caption, { selector: 'div' }).parentElement!;
}

describe('DashboardPage when the applications read fails', () => {
  it('shows the error with a way to retry on the Yellow Card tab, and never the empty state', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    await renderDashboard();

    expect(screen.getByRole('alert')).toHaveTextContent(YELLOW_CARD_ERROR);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('No Yellow Card applications yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Yellow Card/ })).toHaveTextContent(/^Yellow Card$/);
  });

  it('still lists the incident reports and venue bookings', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    await renderDashboard();

    await userEvent.click(screen.getByRole('button', { name: 'Incident Reports (1)' }));
    expect(screen.getByRole('heading', { name: 'INC-2026-000110' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Venue Bookings (1)' }));
    expect(screen.getByRole('heading', { name: 'Booking #BK-2026-000110' })).toBeInTheDocument();
  });

  it('says the Total Requests and Yellow Card Status tiles could not load', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    await renderDashboard();

    expect(tile('Total Requests')).toHaveTextContent("Couldn't load");
    expect(tile('Yellow Card Status')).toHaveTextContent("Couldn't load");
    expect(tile('Yellow Card Status')).not.toHaveTextContent('Not Applied');
    // The two tiles fed by reads that worked still show their numbers.
    expect(tile('Incident Reports')).not.toHaveTextContent("Couldn't load");
    expect(tile('Venue Bookings')).not.toHaveTextContent("Couldn't load");
  });
});

describe('DashboardPage when the incidents read fails', () => {
  it('shows the error on the Incident tab, and says its tiles could not load', async () => {
    vi.mocked(getMyIncidents).mockRejectedValue(new Error(INCIDENTS_ERROR));

    await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: 'Incident Reports' }));

    expect(screen.getByRole('alert')).toHaveTextContent(INCIDENTS_ERROR);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('No incident reports yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report an Incident' })).not.toBeInTheDocument();
    expect(tile('Total Requests')).toHaveTextContent("Couldn't load");
    expect(tile('Incident Reports')).toHaveTextContent("Couldn't load");
    expect(tile('Venue Bookings')).not.toHaveTextContent("Couldn't load");
    expect(tile('Yellow Card Status')).not.toHaveTextContent("Couldn't load");
  });
});

describe('DashboardPage when the bookings read fails', () => {
  it('shows the error on the Venue Bookings tab, and says its tiles could not load', async () => {
    vi.mocked(getMyBookings).mockRejectedValue(new Error(BOOKINGS_ERROR));

    await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: 'Venue Bookings' }));

    expect(screen.getByRole('alert')).toHaveTextContent(BOOKINGS_ERROR);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('No venue bookings yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book a Venue' })).not.toBeInTheDocument();
    expect(tile('Total Requests')).toHaveTextContent("Couldn't load");
    expect(tile('Venue Bookings')).toHaveTextContent("Couldn't load");
    expect(tile('Incident Reports')).not.toHaveTextContent("Couldn't load");
  });
});

describe('DashboardPage "Try again"', () => {
  it('re-runs the reads and shows the lists, counts and tiles once they succeed', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValueOnce(new Error(YELLOW_CARD_ERROR))
      .mockResolvedValueOnce([application]);
    vi.spyOn(yellowCardService, 'getMyCards').mockResolvedValue([activeCard]);

    await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Application #YC-2026-000110' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yellow Card (1)' })).toBeInTheDocument();
    expect(tile('Yellow Card Status')).toHaveTextContent('Card Active');
    expect(tile('Total Requests')).not.toHaveTextContent("Couldn't load");
    // An outage that broke one read probably broke the others: all four re-run.
    expect(getMyIncidents).toHaveBeenCalledTimes(2);
    expect(getMyBookings).toHaveBeenCalledTimes(2);
    expect(yellowCardService.getMyCards).toHaveBeenCalledTimes(2);
  });

  it('says it is trying again while the reads are under way', async () => {
    const getMyApplications = vi
      .spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValueOnce(new Error(YELLOW_CARD_ERROR));
    let finishRead: (applications: MyYellowCardApplication[]) => void = () => {};
    getMyApplications.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));

    await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('button', { name: 'Trying again…' })).toBeDisabled();

    finishRead([application]);

    expect(await screen.findByRole('heading', { name: 'Application #YC-2026-000110' })).toBeInTheDocument();
  });

  it('stays on the error state when the retry fails too', async () => {
    const getMyApplications = vi
      .spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(getMyApplications).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent(YELLOW_CARD_ERROR);
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });
});

describe('DashboardPage after a self-service action', () => {
  // The re-read used to fall back to an empty list, so the citizen's requests
  // seemed to vanish right after they acted on one.
  it('shows the error, not an empty list, when the re-read fails', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications')
      .mockResolvedValueOnce([application])
      .mockRejectedValueOnce(new Error(YELLOW_CARD_ERROR));
    vi.spyOn(yellowCardService, 'withdrawApplication').mockResolvedValue(undefined);

    await renderDashboard();
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw application' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, withdraw it' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(YELLOW_CARD_ERROR);
    expect(screen.queryByRole('heading', { name: 'Application #YC-2026-000110' })).not.toBeInTheDocument();
    expect(screen.queryByText('No Yellow Card applications yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });
});

describe('DashboardPage when every read succeeds with no records', () => {
  it('shows the empty states, calls to action, (0) counts and "Not Applied" as before', async () => {
    vi.mocked(getMyIncidents).mockResolvedValue([]);
    vi.mocked(getMyBookings).mockResolvedValue([]);
    vi.spyOn(yellowCardService, 'getMyApplications').mockResolvedValue([]);

    await renderDashboard();

    expect(screen.getByText('No Yellow Card applications yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yellow Card (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Incident Reports (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Venue Bookings (0)' })).toBeInTheDocument();
    expect(tile('Yellow Card Status')).toHaveTextContent('Not Applied');
    expect(screen.queryByText("Couldn't load")).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Incident Reports (0)' }));
    expect(screen.getByRole('button', { name: 'Report an Incident' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Venue Bookings (0)' }));
    expect(screen.getByRole('button', { name: 'Book a Venue' })).toBeInTheDocument();
  });
});

describe('DashboardPage when only the cards read fails', () => {
  it('says the Yellow Card Status could not load, and still lists the applications', async () => {
    vi.spyOn(yellowCardService, 'getMyCards').mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    await renderDashboard();

    expect(tile('Yellow Card Status')).toHaveTextContent("Couldn't load");
    expect(tile('Yellow Card Status')).not.toHaveTextContent('Not Applied');
    expect(tile('Yellow Card Status')).not.toHaveTextContent('Pending');
    expect(screen.getByRole('heading', { name: 'Application #YC-2026-000110' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yellow Card (1)' })).toBeInTheDocument();
  });

  // The tile says it couldn't load; the Yellow Card tab says why and offers the
  // retry, so a cards-only failure is not a dead end.
  it('shows the error with a way to retry on the Yellow Card tab, above the applications', async () => {
    vi.spyOn(yellowCardService, 'getMyCards')
      .mockRejectedValueOnce(new Error(YELLOW_CARD_ERROR))
      .mockResolvedValueOnce([activeCard]);

    await renderDashboard();

    expect(screen.getByRole('alert')).toHaveTextContent(YELLOW_CARD_ERROR);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(tile('Yellow Card Status')).toHaveTextContent('Card Active'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
