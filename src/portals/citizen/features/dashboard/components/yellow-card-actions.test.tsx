import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import YellowCardActions from '@/portals/citizen/features/dashboard/components/yellow-card-actions';
import {
  YELLOW_CARD_APPLICATION_STATUSES,
  type MyYellowCardApplication,
  type YellowCardApplicationStatus,
} from '@/portals/citizen/features/yellow-card/types';

const application = (status: string): MyYellowCardApplication => ({
  id: 'yc-1',
  reference_number: 'YC-2026-000001',
  status,
  needs_dedup_review: false,
  first_name: 'Juan',
  middle_name: null,
  last_name: 'Dela Cruz',
  suffix: null,
  date_of_birth: '1990-01-01',
  gender_code: 'male',
  civil_status_code: 'single',
  barangay_code: 'barangay-1',
  barangay_name: 'Barangay 1',
  complete_address: '1 Quezon Avenue',
  contact_number: '09171234567',
  email_address: 'juan@example.com',
  years_of_residency: 5,
  voter_id_number: 'VIN-0001',
  privacy_consent: true,
  submitted_at: '2026-10-30T02:00:00Z',
  sla_target_hours: 72,
  due_at: null,
  decided_at: null,
  current_decision: null,
  current_reason: null,
  current_reviewed_at: null,
  document_count: 1,
});

// Typed against the union, so a misspelt status here fails the typecheck
// instead of silently testing a status that does not exist.
const WITHDRAWABLE: readonly YellowCardApplicationStatus[] = ['pending', 'revision_requested'];
const NOT_WITHDRAWABLE: readonly YellowCardApplicationStatus[] = [
  'resubmitted',
  'approved',
  'rejected',
  'withdrawn',
];

describe('YellowCardActions', () => {
  // A status added to the union must be sorted into one list or the other, so
  // it cannot go untested.
  it('covers every application status exactly once', () => {
    expect([...WITHDRAWABLE, ...NOT_WITHDRAWABLE].sort()).toEqual([...YELLOW_CARD_APPLICATION_STATUSES].sort());
  });

  it.each(WITHDRAWABLE)('offers withdrawal on a %s application', (status) => {
    render(<YellowCardActions application={application(status)} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Withdraw application' })).toBeInTheDocument();
  });

  // Issue #89: `resubmitted` is live, but the DB refuses to withdraw it, so a
  // button here could only ever end in "can no longer be withdrawn".
  it.each(NOT_WITHDRAWABLE)('renders nothing on a %s application', (status) => {
    const { container } = render(<YellowCardActions application={application(status)} onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Issue #109: `status` is a plain string on the row, so a value the frontend
  // does not know must fall through the guard and render nothing.
  it('renders nothing on an application with an unknown status', () => {
    const { container } = render(<YellowCardActions application={application('archived')} onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
