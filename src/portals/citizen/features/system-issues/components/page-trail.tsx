'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordPath } from '@/portals/citizen/features/system-issues/lib/capture-context';

/**
 * Remembers the path before the current one, so a website-problem report can
 * say which page the Citizen came from (see `capture-context.ts`). Renders
 * nothing; mounted once in the Citizen layout.
 */
export default function PageTrail() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) recordPath(pathname);
  }, [pathname]);
  return null;
}
