// src/portals/admin/features/sla/hooks/use-sla-row-filter.ts
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readSlaLink, SlaLink, SlaRowFilter } from "@/portals/admin/features/sla/lib/sla-links";

/**
 * The filter a Yellow Card or Incident Reports page arrived with from SLA
 * Reports (#127). `link` is read once, on mount, so the page can seed its
 * range and date type from it; after that the reader owns those controls.
 * `clear` drops the filter and the query string, so a reload doesn't bring
 * it back.
 */
export function useSlaRowFilter<B extends string>(
  path: string,
  bases: readonly B[]
): { link: SlaLink<B> | null; filter: SlaRowFilter | null; clear: () => void } {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [link] = useState(() => readSlaLink(searchParams, bases));
  const [filter, setFilter] = useState<SlaRowFilter | null>(link?.filter ?? null);

  function clear() {
    setFilter(null);
    router.replace(path, { scroll: false });
  }

  return { link, filter, clear };
}
