import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IncidentOriginalNote from '@/portals/citizen/features/dashboard/components/incident-original-note';

describe('IncidentOriginalNote', () => {
  it("names the Original a Duplicate was closed against", () => {
    render(<IncidentOriginalNote originalReference="INC-2026-000076" />);
    expect(screen.getByText(/Duplicate of/)).toHaveTextContent('Duplicate of: INC-2026-000076');
  });

  it('renders nothing on a report that is not a Duplicate', () => {
    const { container } = render(<IncidentOriginalNote originalReference={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
