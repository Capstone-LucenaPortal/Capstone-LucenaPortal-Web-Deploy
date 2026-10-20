import Link from "next/link";
import { cn } from "@/portals/staff/lib/utils";

export interface LinkTabOption {
  value: string;
  label: string;
  count: number;
  href: string;
}

/**
 * The URL-driven tab row. It replaced a client-side `StatusTabs`, deleted once
 * Booking — its last consumer — moved its filter into the URL.
 *
 * A queue that filters in SQL cannot hold its filter in useState — the state
 * lives in the URL so the server read can see it, which also makes a filtered
 * queue linkable and survivable across a refresh. No client component needed.
 */
export function LinkTabs({
  options,
  activeValue,
  trailing,
}: {
  options: LinkTabOption[];
  activeValue: string;
  /** Optional controls pinned to the right of the tab row. */
  trailing?: React.ReactNode;
}) {
  return (
    <nav className="mt-4 flex flex-wrap items-center gap-2 border-b border-gray-200">
      {options.map((option) => {
        const active = option.value === activeValue;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              active
                ? "border-lucena-blue text-lucena-blue"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {option.label} ({option.count})
          </Link>
        );
      })}
      {trailing && <div className="ml-auto pb-1.5">{trailing}</div>}
    </nav>
  );
}
