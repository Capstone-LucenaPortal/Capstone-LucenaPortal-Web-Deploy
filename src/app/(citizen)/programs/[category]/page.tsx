import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProgramCategoryPage } from '@/portals/citizen/features/content/components/program-pages';
import { PROGRAM_CATEGORIES, getProgramCategory } from '@/portals/citizen/features/content/lib/programs';

type Props = { params: Promise<{ category: string }> };

// Without this an unknown category renders on demand, and because `loading.tsx`
// has already started the response, its not-found page goes out with a 200.
export const dynamicParams = false;

export function generateStaticParams() {
  return PROGRAM_CATEGORIES.map(({ slug }) => ({ category: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getProgramCategory((await params).category);
  return category ? { title: `${category.name} Programs` } : {};
}

export default async function ProgramCategoryRoute({ params }: Props) {
  const category = getProgramCategory((await params).category);
  if (!category) notFound();
  return <ProgramCategoryPage category={category} />;
}
