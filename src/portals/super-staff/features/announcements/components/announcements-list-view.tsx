"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { formatDate } from "@/portals/super-staff/lib/utils";
import { cn } from "@/portals/super-staff/lib/utils";
import { computeStatusCounts } from "../lib/lifecycle";
import { listAnnouncements } from "../lib/queries";
import type { Announcement, AnnouncementStatus } from "../types";
import { StatusBadge } from "./announcement-badges";

type Tab = "all" | AnnouncementStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Draft", label: "Draft" },
  { key: "Scheduled", label: "Scheduled" },
  { key: "Published", label: "Published" },
  { key: "Expired", label: "Expired" },
];

function publishWindow(a: Announcement): string {
  if (!a.startAt) return "—";
  const start = formatDate(a.startAt);
  return a.endAt ? `${start} – ${formatDate(a.endAt)}` : `${start} –`;
}

export function AnnouncementsListView() {
  const [all, setAll] = useState<Announcement[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listAnnouncements()
      .then((rows) => {
        if (!active) return;
        setAll(rows);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(rpcErrorMessage(e, "Could not load announcements."));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => computeStatusCounts(all), [all]);
  const rows = useMemo(
    () => (tab === "all" ? all : all.filter((a) => a.status === tab)),
    [all, tab],
  );
  const countFor = (key: Tab) => (key === "all" ? counts.all : counts[key]);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">Announcements</h1>
          <p className="text-gray-500 mt-2">
            Front-page notices for the Citizen Portal.
          </p>
        </div>
        <Link href="/super-staff/announcements/new">
          <Button variant="primary">+ New announcement</Button>
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
            {t.label} ({countFor(t.key)})
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Title</th>
              <th className="px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Publish window
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Last edited
              </th>
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
                  No announcements yet.
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.title}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {a.categoryLabel ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: a.colorHex ?? "#9CA3AF" }}
                        />
                        {a.categoryLabel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{publishWindow(a)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatDate(a.lastEditedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super-staff/announcements/${a.id}`}
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
