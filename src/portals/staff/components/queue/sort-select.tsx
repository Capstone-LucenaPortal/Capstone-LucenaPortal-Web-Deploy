"use client";

import { QUEUE_SORT_OPTIONS, type QueueSort } from "@/portals/staff/lib/queue-sort";

/**
 * The queues' Sort by dropdown (#195). It sits inside the queue's GET search
 * form, so it travels with the search term and the hidden status field, and a
 * change submits that form straight away. With JavaScript off it still rides
 * the Search button.
 *
 * Default is the empty value, so the form sends `sort=`, which
 * parseQueueSort reads as Default. The tab links leave it out entirely.
 */
export function SortSelect({ sort }: { sort: QueueSort }) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-gray-600">
      Sort by
      <select
        name="sort"
        defaultValue={sort === "default" ? "" : sort}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-10 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-lucena-blue"
      >
        {QUEUE_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value === "default" ? "" : option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
