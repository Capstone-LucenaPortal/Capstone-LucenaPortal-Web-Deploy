import { ReactNode } from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  // Optional accessible name for the horizontally-scrolling wrapper below.
  // Most DataTable call sites have a focusable element inside a cell (e.g. a
  // per-row "Review" button), which already gives keyboard users a way to
  // Tab into the scroll container. Text-only tables have no such escape
  // hatch, so a scroll container with no focusable descendant can't be
  // reached (let alone scrolled) by keyboard in Chromium-based browsers —
  // the `scrollable-region-focusable` axe rule / WCAG 2.1.1 gap. Passing
  // this prop makes the wrapper itself a labeled, focusable Tab stop
  // (tabIndex 0 + role="region" + aria-label) so arrow keys can scroll it
  // once focused. Only wire this where a table genuinely lacks a focusable
  // cell — don't set it unconditionally on every DataTable usage.
  wrapperLabel?: string;
}

export function DataTable<T>({ columns, rows, rowKey, wrapperLabel }: DataTableProps<T>) {
  return (
    // Narrow viewports (phones/tablets) can't fit every column at a
    // comfortable width; scope the horizontal scroll to the table itself
    // rather than letting it overflow the whole page layout.
    <div
      className="overflow-x-auto"
      {...(wrapperLabel
        ? { tabIndex: 0, role: "region", "aria-label": wrapperLabel }
        : {})}
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={`px-4 py-3 font-semibold ${column.headerClassName ?? ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.header} className={`px-4 py-3 ${column.className ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
