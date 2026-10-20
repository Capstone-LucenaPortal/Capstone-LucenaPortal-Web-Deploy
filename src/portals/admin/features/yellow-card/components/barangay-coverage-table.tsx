// src/portals/admin/features/yellow-card/components/barangay-coverage-table.tsx
"use client";

import { useMemo, useState } from "react";
import { BarangayCoverage } from "@/portals/admin/features/yellow-card/types";
import { barangayTotal } from "@/portals/admin/lib/aggregate";
import { downloadCsv } from "@/portals/admin/lib/csv";
import { Button } from "@/portals/admin/components/ui/button";

type SortKey = "barangay" | "applicants";
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

export function BarangayCoverageTable({ rows }: { rows: BarangayCoverage[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("applicants");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const maxApplicants = useMemo(
    () => Math.max(1, ...rows.map((row) => barangayTotal(row))),
    [rows]
  );

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) => row.barangay.toLowerCase().includes(needle))
      : [...rows];
    filtered.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      if (sortKey === "barangay") {
        return a.barangay.localeCompare(b.barangay) * direction;
      }
      return (barangayTotal(a) - barangayTotal(b)) * direction || a.barangay.localeCompare(b.barangay);
    });
    return filtered;
  }, [rows, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "applicants" ? "desc" : "asc");
    }
  }

  function handleExport() {
    downloadCsv(
      "applicants-by-barangay.csv",
      ["Barangay", "Applicants"],
      visibleRows.map((row) => [row.barangay, barangayTotal(row)])
    );
  }

  return (
    <section className="rounded-none border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Applicants by barangay</h2>
          <p className="text-sm text-gray-500">Ranked · click headers to sort</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          ↓ Export
        </Button>
      </div>

      <div className="px-6 pt-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search barangay…"
          aria-label="Search barangay"
          className="w-full rounded-none border border-gray-300 px-3 py-2 text-sm focus:border-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
        />
      </div>

      <div className="mt-4 max-h-80 overflow-y-auto overflow-x-auto border-b border-gray-200">
        <table className="w-full text-left text-sm">
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
                aria-sort={sortKey === "applicants" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("applicants")}
                  className="inline-flex items-center gap-1 uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
                >
                  Applicants <SortArrow active={sortKey === "applicants"} dir={sortDir} />
                  <SortStatusText active={sortKey === "applicants"} dir={sortDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.map((row) => {
              const total = barangayTotal(row);
              const isEmpty = total === 0;
              return (
                <tr key={row.barangay} className={isEmpty ? "text-gray-500" : ""}>
                  <td className={`px-6 py-2.5 font-medium ${isEmpty ? "" : "text-gray-900"}`}>
                    {row.barangay}
                  </td>
                  <td className="w-3/5 px-3 py-2.5">
                    {isEmpty ? (
                      <span className="text-xs">no applicants</span>
                    ) : (
                      <div
                        className="h-2 bg-blue-800"
                        style={{ width: `${Math.max(4, (total / maxApplicants) * 100)}%` }}
                      />
                    )}
                  </td>
                  <td className="px-6 py-2.5 text-right font-semibold tabular-nums">
                    {total}
                  </td>
                </tr>
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                  No barangay matches “{query}”. Clear the search to see all barangays.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="m-6 flex items-start gap-2 border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-blue-900 text-[10px] font-bold">
          i
        </span>
        <p>
          Cross-reference with your barangay population figures for coverage analysis. Barangays
          with 0 applicants may indicate outreach gaps.
        </p>
      </div>
    </section>
  );
}
