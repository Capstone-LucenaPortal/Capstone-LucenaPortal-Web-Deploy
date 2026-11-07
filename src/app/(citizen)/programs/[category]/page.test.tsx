import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgramCategoryRoute, { dynamicParams, generateMetadata, generateStaticParams } from './page';

const params = (category: string) => Promise.resolve({ category });

describe('/programs/[category]', () => {
  it('prerenders one page per category', () => {
    expect(generateStaticParams()).toHaveLength(9);
    expect(generateStaticParams()).toContainEqual({ category: 'senior-citizen' });
  });

  it('renders the category in its address', async () => {
    render(await ProgramCategoryRoute({ params: params('senior-citizen') }));
    expect(screen.getByRole('heading', { level: 1, name: 'Senior Citizen Programs' })).toBeInTheDocument();
  });

  it('answers 404 for an address that is not a category', async () => {
    await expect(ProgramCategoryRoute({ params: params('health') })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('serves only the prerendered categories, so anything else is a real 404 status', () => {
    expect(dynamicParams).toBe(false);
  });

  it('titles the page after its category', async () => {
    expect((await generateMetadata({ params: params('wedding') })).title).toBe('Wedding Programs');
  });
});
