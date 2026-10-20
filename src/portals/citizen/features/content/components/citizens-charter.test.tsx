import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CitizensCharter from '@/portals/citizen/features/content/components/citizens-charter';

const getYellowCardConfig = vi.fn();
const getYellowCardDocumentTypes = vi.fn();
const getIncidentConfig = vi.fn();
const getBookingConfig = vi.fn();
const getSiteInfo = vi.fn();

vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: {
    getYellowCardConfig: () => getYellowCardConfig(),
    getYellowCardDocumentTypes: () => getYellowCardDocumentTypes(),
    getIncidentConfig: () => getIncidentConfig(),
    getBookingConfig: () => getBookingConfig(),
    getSiteInfo: () => getSiteInfo(),
  },
}));

/** Mock mode / no backend: every catalog read resolves empty, never throws. */
function withoutBackend() {
  getYellowCardConfig.mockResolvedValue(null);
  getYellowCardDocumentTypes.mockResolvedValue([]);
  getIncidentConfig.mockResolvedValue(null);
  getBookingConfig.mockResolvedValue(null);
  getSiteInfo.mockResolvedValue(null);
}

function withBackend() {
  getYellowCardConfig.mockResolvedValue({ processing_time_target_days: 2 });
  getYellowCardDocumentTypes.mockResolvedValue([
    { code: 'voter_id', label: "Valid Voter's ID", is_required: true, sort_order: 1 },
  ]);
  getIncidentConfig.mockResolvedValue({
    sla_hours_critical: 4,
    sla_hours_high: 8,
    sla_hours_medium: 24,
    sla_hours_low: 72,
    nudge_day: 5,
    auto_close_day: 7,
    confirmation_window_days: 3,
    max_active_reports_per_citizen: 3,
    max_photos_per_cycle: 3,
  });
  getBookingConfig.mockResolvedValue({
    downpayment_pct: 50,
    payment_window_hours: 72,
    min_duration_hours: 6,
    opening_hour: 6,
    closing_hour: 22,
    balance_due_days_before_event: 7,
  });
  getSiteInfo.mockResolvedValue({
    trunkline: '(042) 788-2298',
    office_hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CitizensCharter', () => {
  // This is acceptance criterion 2 in executable form. The component is never
  // wrapped in ProtectedRoute and never reads a session; if either changes,
  // this test is what catches it.
  it('renders all three services with no session and no backend', async () => {
    withoutBackend();
    render(<CitizensCharter />);

    expect(await screen.findByText('Yellow Card Application')).toBeTruthy();
    expect(screen.getByText('Incident Report')).toBeTruthy();
    expect(
      screen.getByText('Lucena Convention Center (LCC) Booking'),
    ).toBeTruthy();
  });

  it('publishes the live processing time once the catalogs load', async () => {
    withBackend();
    render(<CitizensCharter />);

    expect(await screen.findByText('2 business days')).toBeTruthy();
    expect(
      screen.getByText('Critical: 4 hours · High: 8 hours · Medium: 24 hours · Low: 72 hours'),
    ).toBeTruthy();
  });

  it('degrades to prose rather than a blank when the catalogs are unavailable', async () => {
    withoutBackend();
    render(<CitizensCharter />);

    expect(await screen.findByText('A few business days')).toBeTruthy();
    expect(
      screen.getByText('Varies by the severity assigned to the report'),
    ).toBeTruthy();
  });

  it('keeps a single h1 so the page matches the portal heading baseline', async () => {
    withoutBackend();
    render(<CitizensCharter />);
    await screen.findByText('Yellow Card Application');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('stays readable when a catalog read rejects', async () => {
    withoutBackend();
    getIncidentConfig.mockRejectedValue(new Error('network down'));
    render(<CitizensCharter />);

    expect(await screen.findByText('Yellow Card Application')).toBeTruthy();
    expect(screen.getByText('Incident Report')).toBeTruthy();
  });
});
