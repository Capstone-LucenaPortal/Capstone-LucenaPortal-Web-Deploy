import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ProgramCategoryPage, ProgramsOverview } from './program-pages';
import { PROGRAM_CATEGORIES, getProgramCategory } from '@/portals/citizen/features/content/lib/programs';

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

  it("shows each program's name, description, images and steps under their own heading", () => {
    render(
      <ProgramCategoryPage
        category={{
          ...wedding,
          programs: [
            {
              name: 'Sample Program',
              description: 'A sample description.',
              steps: { heading: 'How to Claim', text: 'Sample claiming steps.' },
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
    expect(screen.getByText('How to Claim')).toBeInTheDocument();
    expect(screen.getByText('Sample claiming steps.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'First photo' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Second photo' })).toBeInTheDocument();
  });

  it('leaves out the steps box for a program without steps', () => {
    render(
      <ProgramCategoryPage
        category={{
          ...wedding,
          programs: [{ name: 'Sample Program', description: 'A sample description.', images: [] }],
        }}
      />,
    );
    expect(screen.queryByText(/how to (apply|claim)/i)).not.toBeInTheDocument();
  });

  it('lists all three Senior Citizen programs, with how to claim the Libreng Sine Booklet', () => {
    render(<ProgramCategoryPage category={getProgramCategory('senior-citizen')!} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Libreng Sine para kina Lolo at Lola',
      'Birthday Payout for Senior Citizens (Door-to-Door)',
      'Cash Incentive for Centenarians',
    ]);
    expect(screen.getAllByText('How to Claim')).toHaveLength(1);
    expect(screen.getByText(/bring your Senior Citizen ID/)).toBeInTheDocument();
  });

  it.each(['agricultural', 'senior-citizen', 'wellness'])(
    'gives %s places for its photos before they arrive',
    (slug) => {
      render(<ProgramCategoryPage category={getProgramCategory(slug)!} />);
      expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    },
  );

  it('leaves no placeholder text outside the Animal category, only photo boxes', () => {
    for (const category of PROGRAM_CATEGORIES.filter(({ slug }) => slug !== 'animal')) {
      const { unmount } = render(<ProgramCategoryPage category={category} />);
      const placeholders = screen.queryAllByText(/placeholder/i).map((element) => element.textContent);
      expect(placeholders.filter((text) => text !== 'Image placeholder')).toEqual([]);
      unmount();
    }
  });
});
