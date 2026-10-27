import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncidentCardActions from '@/portals/citizen/features/dashboard/components/incident-card-actions';
import type { MyIncident } from '@/portals/citizen/features/incidents/types';
import type { IncidentConfig } from '@/portals/citizen/lib/supabase/catalogs';

const confirmResolution = vi.fn(() => Promise.resolve());
const reopenIncident = vi.fn(() => Promise.resolve());
const uploadIncidentPhoto = vi.fn(() => Promise.resolve());
const getResolutionPhotos = vi.fn<(id: string) => Promise<unknown[]>>(() => Promise.resolve([]));
const getIncidentPhotoUrl = vi.fn<(id: string) => Promise<string | null>>(() => Promise.resolve(null));

vi.mock('@/portals/citizen/features/incidents/lib/incidents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/portals/citizen/features/incidents/lib/incidents')>();
  return {
    ...actual,
    confirmResolution: (...args: unknown[]) => confirmResolution(...(args as [])),
    reopenIncident: (...args: unknown[]) => reopenIncident(...(args as [])),
    uploadIncidentPhoto: (...args: unknown[]) => uploadIncidentPhoto(...(args as [])),
    getResolutionPhotos: (id: string) => getResolutionPhotos(id),
    getIncidentPhotoUrl: (id: string) => getIncidentPhotoUrl(id),
  };
});

const afterPhoto = (id: string) => ({
  id,
  incident_id: 'inc-1',
  kind: 'after' as const,
  cycle_number: 1,
  is_current_cycle: true,
  uploaded_at: '2026-08-20T01:30:00Z',
});

const config: IncidentConfig = {
  sla_hours_critical: 4,
  sla_hours_high: 24,
  sla_hours_medium: 72,
  sla_hours_low: 168,
  nudge_day: 5,
  auto_close_day: 7,
  confirmation_window_days: 3,
  max_active_reports_per_citizen: 3,
  max_photos_per_cycle: 3,
};

const incident = (overrides: Partial<MyIncident> = {}): MyIncident => ({
  id: 'inc-1',
  reference_number: 'INC-2026-000001',
  incident_type_code: 'streetlight_outage',
  type_label: 'Streetlight outage',
  category_code: 'infrastructure',
  incident_level: 'medium',
  status: 'resolved',
  closure_reason: null,
  is_anonymous: false,
  is_verified: true,
  verified_at: '2026-08-19T02:00:00Z',
  description: 'Lamp post is dark at night.',
  address: 'Quezon Avenue',
  barangay_code: 'brgy_1',
  barangay_name: 'Barangay 1',
  assigned_department_code: 'ceo',
  assigned_department_label: 'City Engineering Office',
  submitted_at: '2026-08-18T02:00:00Z',
  sla_due_at: '2026-08-21T02:00:00Z',
  resolved_at: '2026-08-20T02:00:00Z',
  closed_at: null,
  reopened_count: 0,
  photo_count: 1,
  original_reference: null,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('IncidentCardActions — resolved', () => {
  // The DB sweeper's own notification says "Confirm it in the portal, or it
  // will close automatically." Until now there was no control to confirm with,
  // and the report held a max_active_reports_per_citizen slot in the meantime.
  it('offers confirm and reopen on a resolved report', () => {
    render(<IncidentCardActions incident={incident()} config={config} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: /it's fixed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reopen/i })).toBeInTheDocument();
  });

  it('shows the auto-close deadline from auto_close_day, the window the sweeper closes it on', () => {
    // Issue #17: resolved 2026-10-25 01:13 PHT + auto_close_day 7, not
    // confirmation_window_days 3. Asserted on the parts rather than one
    // formatted string: the date sits in a <strong> inside a sentence, and a
    // browser may order the parts differently from Node's ICU.
    render(
      <IncidentCardActions
        incident={incident({ resolved_at: '2026-10-24T17:13:00Z' })}
        config={config}
        onChanged={vi.fn()}
      />,
    );
    const notice = screen.getByText(/closes automatically/i).textContent ?? '';
    expect(notice).toMatch(/November/);
    expect(notice).toMatch(/\b1\b/);
    expect(notice).toMatch(/2026/);
  });

  it('confirms and then asks the caller to refetch', async () => {
    const onChanged = vi.fn();
    render(<IncidentCardActions incident={incident()} config={config} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: /it's fixed/i }));
    expect(confirmResolution).toHaveBeenCalledWith('inc-1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('collects a reason before reopening', async () => {
    render(<IncidentCardActions incident={incident()} config={config} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /reopen/i }));

    const reason = screen.getByLabelText(/what is still wrong/i);
    await userEvent.type(reason, 'Still dark.');
    await userEvent.click(screen.getByRole('button', { name: /reopen this report/i }));

    expect(reopenIncident).toHaveBeenCalledWith('inc-1', 'Still dark.');
  });

  it('surfaces a refusal inline rather than throwing it away', async () => {
    reopenIncident.mockRejectedValueOnce(new Error('This report is no longer awaiting your confirmation.'));
    render(<IncidentCardActions incident={incident()} config={config} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /reopen/i }));
    await userEvent.type(screen.getByLabelText(/what is still wrong/i), 'Still dark.');
    await userEvent.click(screen.getByRole('button', { name: /reopen this report/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer awaiting/i);
  });
});

/**
 * SCRUM-190. The responder must attach an after photo to resolve, and the
 * Responder portal is written on the assumption that the citizen sees it. The
 * citizen was asked "Is it actually fixed?" with no evidence at all.
 */
describe('IncidentCardActions — the responder’s after photos', () => {
  it('shows the after photos for this incident beside confirm and reopen', async () => {
    getResolutionPhotos.mockResolvedValueOnce([afterPhoto('ph-1'), afterPhoto('ph-2')]);
    getIncidentPhotoUrl.mockImplementation(async (id: string) => `https://signed.example/${id}`);

    render(<IncidentCardActions incident={incident()} config={config} onChanged={vi.fn()} />);

    const photos = await screen.findAllByRole('img', { name: /after photo/i });
    expect(photos).toHaveLength(2);
    expect(photos[0]).toHaveAttribute('src', 'https://signed.example/ph-1');
    expect(getResolutionPhotos).toHaveBeenCalledWith('inc-1');
    expect(screen.getByRole('button', { name: /it's fixed/i })).toBeInTheDocument();
  });

  it('does not ask for photos on a report that is not resolved', () => {
    render(
      <IncidentCardActions
        incident={incident({ status: 'open', is_verified: false })}
        config={config}
        onChanged={vi.fn()}
      />,
    );
    expect(getResolutionPhotos).not.toHaveBeenCalled();
  });

  it('shows a placeholder, not a broken image, when a photo cannot be opened', async () => {
    getResolutionPhotos.mockResolvedValueOnce([afterPhoto('ph-1')]);
    getIncidentPhotoUrl.mockResolvedValueOnce(null);

    render(<IncidentCardActions incident={incident()} config={config} onChanged={vi.fn()} />);

    expect(await screen.findByText(/photo could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /after photo/i })).not.toBeInTheDocument();
  });

  it('still lets the citizen confirm when the photos fail to load', async () => {
    getResolutionPhotos.mockRejectedValueOnce(new Error('network'));

    render(<IncidentCardActions incident={incident()} config={config} onChanged={vi.fn()} />);

    expect(await screen.findByText(/could not load the department’s photos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /it's fixed/i })).toBeEnabled();
  });
});

describe('IncidentCardActions — unverified', () => {
  // The dashboard used to render "awaiting photo confirmation" with nothing to
  // act on, while the sweeper nudged at day 5 and auto-closed at day 7.
  it('offers a photo upload on an unverified, non-closed report', () => {
    render(
      <IncidentCardActions
        incident={incident({ status: 'open', is_verified: false })}
        config={config}
        onChanged={vi.fn()}
      />,
    );
    // The <label> wraps the input, so both carry the name — query the control.
    expect(screen.getByLabelText(/add a photo/i)).toHaveAttribute('type', 'file');
  });

  it('shows the verification deadline from confirmation_window_days, the window the sweeper expires it on', () => {
    // Issue #17: submitted 2026-10-25 PHT + confirmation_window_days 3, not
    // auto_close_day 7.
    render(
      <IncidentCardActions
        incident={incident({
          status: 'open',
          is_verified: false,
          submitted_at: '2026-10-25T02:00:00Z',
          resolved_at: null,
        })}
        config={config}
        onChanged={vi.fn()}
      />,
    );
    const notice = screen.getByText(/close automatically/i).textContent ?? '';
    expect(notice).toMatch(/October/);
    expect(notice).toMatch(/28/);
    expect(notice).toMatch(/2026/);
  });

  it('offers nothing once the report is closed', () => {
    const { container } = render(
      <IncidentCardActions
        incident={incident({ status: 'closed', is_verified: false })}
        config={config}
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders without a config, just without the deadlines', () => {
    render(<IncidentCardActions incident={incident()} config={null} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: /it's fixed/i })).toBeInTheDocument();
    expect(screen.queryByText(/closes automatically/i)).not.toBeInTheDocument();
  });
});
