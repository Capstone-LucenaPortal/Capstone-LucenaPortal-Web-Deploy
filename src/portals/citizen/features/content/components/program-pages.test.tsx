import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ProgramCategoryPage, ProgramsOverview } from './program-pages';
import { getProgramCategory } from '@/portals/citizen/features/content/lib/programs';

const wedding = getProgramCategory('wedding')!;
const sidebar = () => within(screen.getByRole('navigation', { name: 'Program categories' }));
const breadcrumb = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }));

describe('ProgramsOverview', () => {
  it('lists every category in the sidebar with none marked current', () => {
    render(<ProgramsOverview />);
    const links = sidebar().getAllByRole('link');
    expect(links).toHaveLength(9);
    expect(links.filter((link) => link.hasAttribute('aria-current'))).toEqual([]);
  });

  it('heads the page City Programs', () => {
    render(<ProgramsOverview />);
    expect(screen.getByRole('heading', { level: 1, name: 'City Programs' })).toBeInTheDocument();
  });

  it('leads the breadcrumb back to home', () => {
    render(<ProgramsOverview />);
    expect(breadcrumb().getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });
});

describe('ProgramCategoryPage', () => {
  it('marks only its own category as current in the sidebar', () => {
    render(<ProgramCategoryPage category={wedding} />);
    const current = sidebar().getAllByRole('link').filter((link) => link.hasAttribute('aria-current'));
    expect(current.map((link) => link.textContent)).toEqual(['Wedding']);
    expect(current[0]).toHaveAttribute('href', '/programs/wedding');
  });

  it('heads the page with the category and walks the breadcrumb through Programs', () => {
    render(<ProgramCategoryPage category={wedding} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Wedding Programs' })).toBeInTheDocument();
    expect(breadcrumb().getByRole('link', { name: 'Programs' })).toHaveAttribute('href', '/programs');
    expect(breadcrumb().getByText('Wedding')).toHaveAttribute('aria-current', 'page');
  });

  it("shows each program's name, description, images and how to apply", () => {
    render(
      <ProgramCategoryPage
        category={{
          ...wedding,
          programs: [
            {
              name: 'Sample Program',
              description: 'A sample description.',
              howToApply: 'Sample application steps.',
              images: [
                { src: '/programs/wedding/one.jpg', alt: 'First photo' },
                { src: '/programs/wedding/two.jpg', alt: 'Second photo' },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Sample Program' })).toBeInTheDocument();
    expect(screen.getByText('A sample description.')).toBeInTheDocument();
    expect(screen.getByText('Sample application steps.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'First photo' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Second photo' })).toBeInTheDocument();
  });

  it.each(['agricultural', 'senior-citizen', 'wellness'])(
    'gives %s a place for images and a description before real content arrives',
    (slug) => {
      render(<ProgramCategoryPage category={getProgramCategory(slug)!} />);
      expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
      expect(screen.getByText(/placeholder program description/i)).toBeInTheDocument();
    },
  );
});
