// src/portals/admin/features/sla/hooks/use-sla-row-filter.ts
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readSlaLink, SlaLink, SlaRowFilter } from "@/portals/admin/features/sla/lib/sla-links";

export interface SlaRowFilterState<B extends string> {
  /** What the current address carries, or null when it carries no filter. */
  link: SlaLink<B> | null;
  /** The filter narrowing the table: the address's, unless Clear just dropped it. */
  filter: SlaRowFilter | null;
  /** Drops the filter and the query string, so a reload doesn't bring it back. */
  clear: () => void;
  /**
   * Changes each time the page lands on an address, except the clean one
   * Clear leads to. The page keys its body on it, so every address it lands
   * on (the sidebar link, Back, Forward) looks as if opened fresh, with the
   * range and date type its link carries; after that the reader owns those
   * controls (#131).
   */
  arrival: number;
}

/**
 * A page with no filter and no link: what Yellow Card, Incident Reports and
 * the Convention Center show while a build prerenders them, before there is an address to read
 * (#133).
 */
export const NO_SLA_ROW_FILTER: SlaRowFilterState<never> = {
  link: null,
  filter: null,
  clear: () => {},
  arrival: 0,
};

/**
 * The filter a Yellow Card, Incident Reports or Convention Center page
 * arrived with from SLA Reports (#127, #175). The address is its only source: the page doesn't remount
 * when only the query string changes, so this reads it on every render
 * rather than once (#131).
 */
export function useSlaRowFilter<B extends string>(path: string, bases: readonly B[]): SlaRowFilterState<B> {
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams?.toString() ?? "";
  const link = readSlaLink(searchParams, bases);

  const [landing, setLanding] = useState({ search, arrival: 0, clearing: false });
  let current = landing;
  if (landing.search !== search) {
    // Clear's own clean address keeps the page as the reader has it; any
    // other address is a new arrival.
    const cleared = landing.clearing && link === null;
    current = { search, arrival: cleared ? landing.arrival : landing.arrival + 1, clearing: false };
    setLanding(current);
  }

  function clear() {
    // The filter goes at once, not when the router has caught up.
    setLanding((state) => ({ ...state, clearing: true }));
    router.replace(path, { scroll: false });
  }

  return {
    link,
    filter: current.clearing ? null : (link?.filter ?? null),
    clear,
    arrival: current.arrival,
  };
}
