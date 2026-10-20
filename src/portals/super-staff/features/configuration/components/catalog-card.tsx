"use client";

import type { ReactNode } from "react";
import { Badge } from "@/portals/super-staff/components/ui/badge";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { Input, numValue } from "@/portals/super-staff/components/ui/input";
import { cn } from "@/portals/super-staff/lib/utils";
import type { ConfigErrors } from "../lib/validation";

/**
 * The presentational shell the seven catalog editors share. It enforces two
 * rules for every catalog:
 *
 *  - NO "+ Add" button and NO delete control. Row sets are migration-owned:
 *    `code` primary keys are referenced by incidents, bookings and friends, so
 *    a row can never truly be removed. Deactivation is the only retirement.
 *  - An INACTIVE ROW STAYS VISIBLE AND EDITABLE. Being able to see and
 *    reactivate a retired row is the reason the super_* views were built.
 */
export function CatalogCard({
  title,
  rowCount,
  headers,
  note,
  loading,
  error,
  children,
}: {
  title: string;
  rowCount: number;
  headers: string[];
  note?: ReactNode;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <span className="text-sm text-gray-500">
          {rowCount} {rowCount === 1 ? "row" : "rows"}
        </span>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : loading ? (
          <p className="text-sm text-gray-500">Loading&hellip;</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-gray-500">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-500">
                    <span className="sr-only">Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>{children}</tbody>
            </table>
          </div>
        )}
        {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * One catalog row. Save/Revert appear only while this row is dirty.
 *
 * They are rendered on every row and merely made invisible while it is clean:
 * the table sizes its columns to their content, so a cell that grew from "—"
 * to two buttons shoved every other column sideways the moment you typed.
 * `invisible` keeps their width; `aria-hidden` and `disabled` keep them out of
 * the accessibility tree and unclickable. The dash sits in the same grid cell.
 */
export function CatalogRow({
  isActive = true,
  dirty,
  saving,
  onSave,
  onRevert,
  children,
}: {
  /** Pass `true` for catalogs with no is_active column (classifications). */
  isActive?: boolean;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onRevert: () => void;
  children: ReactNode;
}) {
  return (
    <tr
      className={cn(
        "border-b border-gray-100 last:border-0",
        !isActive && "bg-gray-50 text-gray-500",
      )}
    >
      {children}
      <td className="px-4 py-2 text-right whitespace-nowrap">
        <span className="inline-grid items-center justify-items-end">
          <span
            className={cn("col-start-1 row-start-1 inline-flex gap-2", !dirty && "invisible")}
            aria-hidden={!dirty}
          >
            <Button variant="secondary" size="sm" onClick={onRevert} disabled={saving || !dirty}>
              Revert
            </Button>
            <Button variant="primary" size="sm" onClick={onSave} disabled={saving || !dirty}>
              {/* Both labels share one grid cell, so "Saving…" cannot widen it. */}
              <span className="inline-grid">
                <span className={cn("col-start-1 row-start-1", saving && "invisible")} aria-hidden={saving}>
                  Save
                </span>
                <span className={cn("col-start-1 row-start-1", !saving && "invisible")} aria-hidden={!saving}>
                  Saving…
                </span>
              </span>
            </Button>
          </span>
          {!dirty && (
            <span className="col-start-1 row-start-1 text-xs text-gray-500">&mdash;</span>
          )}
        </span>
      </td>
    </tr>
  );
}

/** The muted marker an inactive row carries. */
export function InactiveBadge() {
  return <Badge variant="default">Inactive</Badge>;
}

/**
 * A badge that comes and goes with a checkbox beside it — Inactive, Retired,
 * Closed. Always rendered, invisible while not `shown`, for the same reason as
 * CatalogRow's actions: its column must not widen when the box is unticked.
 */
export function ReservedBadge({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <span className={cn(!shown && "invisible")} aria-hidden={!shown}>
      {children}
    </span>
  );
}

/** A value the database owns and the editor must not pretend to change. */
export function ReadOnlyCell({ children }: { children: ReactNode }) {
  return <span className="text-xs text-gray-500">{children}</span>;
}

// ── The cells every catalog row is built from ──────────────────────────────
// These were seven verbatim copies before. Each takes the row's key and derives
// its own `aria-label` from it, which is what the smoke tests and any future
// accessibility check key off — one place to keep that convention.
//
// `rowKey`, not `code`: six catalogs are keyed by the migration-owned TEXT
// `code`, but site-info entries are keyed by a uuid `id`, and two of those
// share a label. The hook calls it a key throughout (`keyOf`, `dirtyKeys`,
// `savingKey`), so these follow it rather than naming one caller's column.
//
// All three editable cells take the whole `ConfigErrors` for their row and
// pick out their own field, so no call site has to know which key belongs to
// which cell.

/** The editable name of a row. */
export function LabelCell({
  rowKey,
  value,
  errors,
  onChange,
}: {
  rowKey: string;
  value: string;
  errors?: ConfigErrors;
  onChange: (label: string) => void;
}) {
  return (
    <td className="px-4 py-2">
      <Input
        aria-label={`${rowKey} label`}
        value={value}
        error={errors?.label}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}

/** Any other free-text column — a venue's capacity phrase, a hotline number. */
export function TextCell({
  rowKey,
  field,
  value,
  errors,
  placeholder,
  onChange,
}: {
  rowKey: string;
  /** Completes the aria-label, e.g. "capacity" → "atrium capacity", AND is
   *  the `ConfigErrors` key this cell reads. Keep the two in step. */
  field: string;
  value: string;
  errors?: ConfigErrors;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <td className="px-4 py-2">
      <Input
        aria-label={`${rowKey} ${field}`}
        value={value}
        error={errors?.[field]}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}

/**
 * Publication order. `valueAsNumber` is NaN for a cleared field, so this passes
 * the raw NaN up: the editor's `validate` refuses the save and the error lands
 * back here, rather than the field silently rewriting itself to 0.
 */
export function SortCell({
  rowKey,
  value,
  errors,
  onChange,
}: {
  rowKey: string;
  value: number;
  errors?: ConfigErrors;
  onChange: (sortOrder: number) => void;
}) {
  return (
    <td className="px-4 py-2">
      <Input
        aria-label={`${rowKey} sort order`}
        type="number"
        min={0}
        value={numValue(value)}
        error={errors?.sortOrder}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </td>
  );
}

/** A plain boolean column — "Required", "Discount eligible". */
export function CheckboxCell({
  rowKey,
  field,
  checked,
  onChange,
}: {
  rowKey: string;
  /** Completes the aria-label, e.g. "required" → "doc_x required", AND is
   *  the `ConfigErrors` key this cell reads. Keep the two in step. */
  field: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <td className="px-4 py-2">
      <input
        type="checkbox"
        aria-label={`${rowKey} ${field}`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-lucena-blue"
      />
    </td>
  );
}

/**
 * The retirement switch. Deactivation is the ONLY retirement a catalog row has
 * — the badge sits beside the box rather than replacing the row, because being
 * able to see and reactivate a retired row is the point of these editors.
 */
export function ActiveCell({
  rowKey,
  checked,
  onChange,
}: {
  rowKey: string;
  checked: boolean;
  onChange: (isActive: boolean) => void;
}) {
  return (
    <td className="px-4 py-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label={`${rowKey} active`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-lucena-blue"
        />
        <ReservedBadge shown={!checked}>
          <InactiveBadge />
        </ReservedBadge>
      </label>
    </td>
  );
}
