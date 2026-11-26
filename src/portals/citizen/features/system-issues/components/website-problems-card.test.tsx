import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import WebsiteProblemsCard from '@/portals/citizen/features/system-issues/components/website-problems-card';
import type { MySystemIssue } from '@/portals/citizen/features/system-issues/types';

const open: MySystemIssue = {
  id: 'si-1',
  referenceNumber: 'SI-2026-000001',
  category: 'lcc',
  description: 'The booking calendar never finishes loading.',
  status: 'open',
  createdAt: '2026-11-25T02:00:00+00:00',
  resolutionNote: null,
  closesAt: null,
  closeReason: null,
  closeNote: null,
};

/** The row that carries a reference, found by it. */
function row(reference: string): HTMLElement {
  return screen.getByText(reference).closest('li')!;
}

describe('WebsiteProblemsCard', () => {
  it('renders nothing when the Citizen has reported no website problems', () => {
    const { container } = render(<WebsiteProblemsCard issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each report with its reference, area and description, in the order given', () => {
    render(
      <WebsiteProblemsCard
        issues={[
          open,
          { ...open, id: 'si-2', referenceNumber: 'SI-2026-000002', category: 'accounts', description: 'Sign-in loops back.' },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Website problems you reported' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('SI-2026-000001');
    expect(items[0]).toHaveTextContent('LCC Bookings');
    expect(items[0]).toHaveTextContent('The booking calendar never finishes loading.');
    expect(items[1]).toHaveTextContent('SI-2026-000002');
    expect(items[1]).toHaveTextContent('Accounts & sign-in');
  });

  it.each([
    ['open', 'Open'],
    ['in_progress', 'In progress'],
    ['resolved', 'Resolved'],
    ['closed', 'Closed'],
  ] as const)('shows the %s status as the "%s" pill', (status, label) => {
    render(<WebsiteProblemsCard issues={[{ ...open, status }]} />);
    expect(within(row('SI-2026-000001')).getByText(label)).toBeInTheDocument();
  });

  it('shows no fix or reason on an open or in-progress row', () => {
    render(<WebsiteProblemsCard issues={[{ ...open, status: 'in_progress' }]} />);
    expect(row('SI-2026-000001')).not.toHaveTextContent('Fixed:');
    expect(row('SI-2026-000001')).not.toHaveTextContent('Closes');
  });

  it('shows the fix and the date a Resolved row closes by itself', () => {
    render(
      <WebsiteProblemsCard
        issues={[{
          ...open,
          status: 'resolved',
          resolutionNote: 'A slow query was fixed.',
          // 9 AM Manila on December 1.
          closesAt: '2026-12-01T01:00:00+00:00',
        }]}
      />,
    );
    expect(row('SI-2026-000001')).toHaveTextContent('Fixed: A slow query was fixed.');
    expect(row('SI-2026-000001')).toHaveTextContent('Closes by itself on December 1, 2026');
  });

  it('keeps the fix but drops the close date once a resolved row has closed by itself', () => {
    render(
      <WebsiteProblemsCard
        issues={[{ ...open, status: 'closed', resolutionNote: 'A slow query was fixed.', closesAt: null }]}
      />,
    );
    expect(row('SI-2026-000001')).toHaveTextContent('Fixed: A slow query was fixed.');
    expect(row('SI-2026-000001')).not.toHaveTextContent('Closes by itself');
  });

  it.each([
    ['not_a_system_issue', 'Not a system issue'],
    ['duplicate', 'Duplicate'],
  ] as const)('shows the reason and the note on a row closed as %s', (closeReason, label) => {
    render(
      <WebsiteProblemsCard
        issues={[{ ...open, status: 'closed', closeReason, closeNote: 'See the note from IT.' }]}
      />,
    );
    expect(row('SI-2026-000001')).toHaveTextContent(`${label}: See the note from IT.`);
    expect(row('SI-2026-000001')).not.toHaveTextContent('Fixed:');
  });

  it('offers no actions', () => {
    render(<WebsiteProblemsCard issues={[{ ...open, status: 'resolved', resolutionNote: 'Fixed.', closesAt: '2026-12-01T01:00:00+00:00' }]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
