import type { Metadata } from 'next';
import { ProgramsOverview } from '@/portals/citizen/features/content/components/program-pages';

export const metadata: Metadata = {
  title: 'City Programs',
};

export default function ProgramsPage() {
  return <ProgramsOverview />;
}
