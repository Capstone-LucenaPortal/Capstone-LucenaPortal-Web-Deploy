import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import YellowCardActions from '@/portals/citizen/features/dashboard/components/yellow-card-actions';
import type { MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';

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

describe('YellowCardActions', () => {
  it.each(['pending', 'revision_requested'])('offers withdrawal on a %s application', (status) => {
    render(<YellowCardActions application={application(status)} onChanged={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Withdraw application' })).toBeInTheDocument();
  });

  // Issue #89: `resubmitted` is live, but the DB refuses to withdraw it, so a
  // button here could only ever end in "can no longer be withdrawn".
  it.each(['resubmitted', 'approved', 'rejected', 'withdrawn'])('renders nothing on a %s application', (status) => {
    const { container } = render(<YellowCardActions application={application(status)} onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
