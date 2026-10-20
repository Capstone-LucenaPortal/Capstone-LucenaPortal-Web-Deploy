"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/portals/super-staff/components/ui/badge";
import { Button } from "@/portals/super-staff/components/ui/button";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { cn, formatDate } from "@/portals/super-staff/lib/utils";
import { listEvents } from "../lib/queries";
import type { CityEvent } from "../types";

// Events have no derived status — `is_published` is a real column — so the
// filter is a plain published/draft pair rather than the posts' four tabs.
type Tab = "all" | "published" | "draft";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
];

function when(e: CityEvent): string {
  const start = formatDate(e.startAt);
  return e.endAt ? `${start} – ${formatDate(e.endAt)}` : start;
}

export function EventsListView() {
  const [all, setAll] = useState<CityEvent[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listEvents()
      .then((rows) => {
        if (!active) return;
        setAll(rows);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(rpcErrorMessage(e, "Could not load events."));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: all.length,
      published: all.filter((e) => e.isPublished).length,
      draft: all.filter((e) => !e.isPublished).length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    if (tab === "all") return all;
    return all.filter((e) => e.isPublished === (tab === "published"));
  }, [all, tab]);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">Events</h1>
          <p className="text-gray-500 mt-2">
            City events shown on the Citizen Portal.
          </p>
        </div>
        <Link href="/super-staff/events/new">
          <Button variant="primary">+ New event</Button>
        </Link>
      </div>

      <div className="mt-6 flex border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key
                ? "border-lucena-blue text-lucena-blue"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Title</th>
              <th className="px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 font-medium text-gray-500">When</th>
              <th className="px-4 py-3 font-medium text-gray-500">Location</th>
              <th className="px-4 py-3 font-medium text-gray-500">Published</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-red-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No events yet.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {e.title}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {e.categoryLabel ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: e.colorHex ?? "#9CA3AF" }}
                        />
                        {e.categoryLabel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{when(e)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {e.locationText ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={e.isPublished ? "success" : "default"}>
                      {e.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super-staff/events/${e.id}`}
                      className="text-sm font-medium text-lucena-blue hover:text-lucena-blue-dark"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && (
        <p className="mt-3 text-sm text-gray-500">
          Showing {rows.length} of {counts.all} results.
        </p>
      )}
    </div>
  );
}
