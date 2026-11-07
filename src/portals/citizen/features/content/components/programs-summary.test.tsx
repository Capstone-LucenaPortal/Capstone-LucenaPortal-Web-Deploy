import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ProgramsSummary from './programs-summary';

describe('ProgramsSummary', () => {
  it("sends each category to that category's own page", () => {
    render(<ProgramsSummary />);
    const categories = within(screen.getByRole('list', { name: 'Program categories' }));
    expect(categories.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/programs/agricultural',
      '/programs/animal',
      '/programs/baptism',
      '/programs/business',
      '/programs/education',
      '/programs/housing',
      '/programs/senior-citizen',
      '/programs/wedding',
      '/programs/wellness',
    ]);
  });

  it('sends "View all programs" to the Programs page', () => {
    render(<ProgramsSummary />);
    expect(screen.getByRole('link', { name: /view all programs/i })).toHaveAttribute('href', '/programs');
  });

  it("keeps the anchor the home page's City Programs slide scrolls to", () => {
    const { container } = render(<ProgramsSummary />);
    expect(container.querySelector('section#city-programs')).not.toBeNull();
  });
});
