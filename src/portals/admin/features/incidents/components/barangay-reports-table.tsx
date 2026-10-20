// src/portals/admin/features/incidents/components/barangay-reports-table.tsx
"use client";

import { useMemo, useState } from "react";
import { BarangayIssueRow } from "@/portals/admin/features/incidents/types";
import { getCategoryChipClasses } from "@/portals/admin/lib/status-colors";
import { downloadCsv } from "@/portals/admin/lib/csv";
import { Button } from "@/portals/admin/components/ui/button";

type SortKey = "barangay" | "reports";
type SortDir = "asc" | "desc";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <span aria-hidden className="text-gray-300">
        ↕
      </span>
    );
  }
  return (
    <span aria-hidden className="text-gray-700">
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

// The glyph above is aria-hidden — screen reader support for `aria-sort` on
// <th> is inconsistent, so this sr-only text is the reliable way to announce
// sort state regardless of whether the AT picks up aria-sort itself.
function SortStatusText({ active, dir }: { active: boolean; dir: SortDir }) {
  const label = !active ? "not sorted" : dir === "asc" ? "sorted ascending" : "sorted descending";
  return <span className="sr-only"> ({label})</span>;
}

export function BarangayReportsTable({
  rows,
  insight,
}: {
  rows: BarangayIssueRow[];
  insight: { emphasis: string; text: string };
}) {
  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.topCategory))].sort(),
    [rows]
  );
  const [category, setCategory] = useState("All categories");
  const [sortKey, setSortKey] = useState<SortKey>("reports");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const maxReports = useMemo(() => Math.max(1, ...rows.map((row) => row.reports)), [rows]);

  const visibleRows = useMemo(() => {
    const filtered =
      category === "All categories" ? [...rows] : rows.filter((row) => row.topCategory === category);
    filtered.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      if (sortKey === "barangay") {
        return a.barangay.localeCompare(b.barangay) * direction;
      }
      return (a.reports - b.reports) * direction || a.barangay.localeCompare(b.barangay);
    });
    return filtered;
  }, [rows, category, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "reports" ? "desc" : "asc");
    }
  }

  function handleExport() {
    downloadCsv(
      "reports-by-barangay.csv",
      ["Barangay", "Reports", "Top Category", "Top Category Count"],
      visibleRows.map((row) => [row.barangay, row.reports, row.topCategory, row.topCategoryCount])
    );
  }

  return (
    <section className="rounded-none border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reports by barangay</h2>
          <p className="text-sm text-gray-500">Ranked hotspots · click headers to sort</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          ↓ Export
        </Button>
      </div>

      <div className="px-6 pt-4">
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-full rounded-none border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
        >
          <option>All categories</option>
          {categories.map((entry) => (
            <option key={entry}>{entry}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 max-h-80 overflow-y-auto overflow-x-auto border-b border-gray-200">
        <table aria-label="Reports by barangay" className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-gray-500 shadow-[inset_0_-1px_0_#e5e7eb]">
            <tr className="border-b border-gray-200">
              <th
                className="px-6 py-3 font-semibold"
                aria-sort={sortKey === "barangay" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("barangay")}
                  className="inline-flex items-center gap-1 uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
                >
                  Barangay <SortArrow active={sortKey === "barangay"} dir={sortDir} />
                  <SortStatusText active={sortKey === "barangay"} dir={sortDir} />
                </button>
              </th>
              <th
                className="px-3 py-3 font-semibold"
                colSpan={2}
                aria-sort={sortKey === "reports" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("reports")}
                  className="inline-flex items-center gap-1 uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
                >
                  Reports <SortArrow active={sortKey === "reports"} dir={sortDir} />
                  <SortStatusText active={sortKey === "reports"} dir={sortDir} />
                </button>
              </th>
              <th className="px-6 py-3 text-right font-semibold">Top Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.map((row) => (
              <tr key={row.barangay}>
                <td className="px-6 py-2.5 font-medium text-gray-900">{row.barangay}</td>
                <td className="w-2/5 px-3 py-2.5">
                  <div
                    className="h-2 bg-blue-800"
                    style={{ width: `${Math.max(4, (row.reports / maxReports) * 100)}%` }}
                  />
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.reports}</td>
                <td className="px-6 py-2.5 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium ${getCategoryChipClasses(row.topCategory)}`}>
                      {row.topCategory}
                    </span>
                    <span className="w-6 text-right text-xs font-medium tabular-nums text-gray-500">
                      {row.topCategoryCount}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                  No barangay has {category} as its top category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="m-6 flex items-start gap-2 border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p>
          <strong>{insight.emphasis}</strong> {insight.text}
        </p>
      </div>
    </section>
  );
}
