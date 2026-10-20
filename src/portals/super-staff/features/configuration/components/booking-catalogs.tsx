"use client";

import {
  ActiveCell,
  CatalogCard,
  CatalogRow,
  CheckboxCell,
  LabelCell,
  ReadOnlyCell,
  SortCell,
  TextCell,
} from "./catalog-card";
import type { CatalogEditor } from "../hooks/use-catalog-editor";
import type {
  BookingClassification,
  BookingEventType,
  BookingVenue,
} from "../lib/catalog-types";

/**
 * Presentation only — the editors these cards take live in
 * `../hooks/use-catalog-editors`, which is also where their RPC commit
 * functions are. Splitting them apart is what stopped this file having two
 * unrelated reasons to change.
 */

// ── Venues ─────────────────────────────────────────────────────────────────
export function VenuesCard({ editor }: { editor: CatalogEditor<BookingVenue> }) {
  return (
    <CatalogCard
      title="Venues"
      rowCount={editor.rows.length}
      headers={["Venue", "Capacity", "Pricing", "Sort", "Active"]}
      loading={editor.loading}
      error={editor.error}
      note="Pricing model is migration-owned. Deactivating a venue removes it from the citizen booking form; the row stays here so it can be brought back."
    >
      {editor.rows.map((row) => (
        <CatalogRow
          key={row.code}
          isActive={row.isActive}
          dirty={editor.dirtyKeys.has(row.code)}
          saving={editor.savingKey === row.code}
          onSave={() => void editor.save(row.code)}
          onRevert={() => editor.revert(row.code)}
        >
          <LabelCell
            rowKey={row.code}
            value={row.label}
            errors={editor.rowErrors[row.code]}
            onChange={(label) => editor.update(row.code, { label })}
          />
          {/* capacity_label is FREE TEXT ("Up to 500 pax"), not a number. */}
          <TextCell
            rowKey={row.code}
            field="capacity"
            value={row.capacityLabel ?? ""}
            onChange={(v) => editor.update(row.code, { capacityLabel: v || null })}
          />
          <td className="px-4 py-2">
            <ReadOnlyCell>
              {row.isHourly ? "Hourly" : "Flat rate"} &mdash; migration-owned.
            </ReadOnlyCell>
          </td>
          <SortCell
            rowKey={row.code}
            value={row.sortOrder}
            errors={editor.rowErrors[row.code]}
            onChange={(sortOrder) => editor.update(row.code, { sortOrder })}
          />
          <ActiveCell
            rowKey={row.code}
            checked={row.isActive}
            onChange={(isActive) => editor.update(row.code, { isActive })}
          />
        </CatalogRow>
      ))}
    </CatalogCard>
  );
}

// ── Event types ────────────────────────────────────────────────────────────
export function EventTypesCard({
  editor,
}: {
  editor: CatalogEditor<BookingEventType>;
}) {
  return (
    <CatalogCard
      title="Event Types"
      rowCount={editor.rows.length}
      headers={["Event type", "Sort", "Active"]}
      loading={editor.loading}
      error={editor.error}
    >
      {editor.rows.map((row) => (
        <CatalogRow
          key={row.code}
          isActive={row.isActive}
          dirty={editor.dirtyKeys.has(row.code)}
          saving={editor.savingKey === row.code}
          onSave={() => void editor.save(row.code)}
          onRevert={() => editor.revert(row.code)}
        >
          <LabelCell
            rowKey={row.code}
            value={row.label}
            errors={editor.rowErrors[row.code]}
            onChange={(label) => editor.update(row.code, { label })}
          />
          <SortCell
            rowKey={row.code}
            value={row.sortOrder}
            errors={editor.rowErrors[row.code]}
            onChange={(sortOrder) => editor.update(row.code, { sortOrder })}
          />
          <ActiveCell
            rowKey={row.code}
            checked={row.isActive}
            onChange={(isActive) => editor.update(row.code, { isActive })}
          />
        </CatalogRow>
      ))}
    </CatalogCard>
  );
}

// ── Classifications ────────────────────────────────────────────────────────
export function ClassificationsCard({
  editor,
}: {
  editor: CatalogEditor<BookingClassification>;
}) {
  return (
    <CatalogCard
      title="Classifications"
      rowCount={editor.rows.length}
      headers={["Classification", "Discount eligible", "Sort"]}
      loading={editor.loading}
      error={editor.error}
      note={
        <>
          Eligibility decides which classifications get the discounted rate tier.
          The peso rates themselves live in <code>booking_venue_rates</code> and
          are changed by migration with the rate sheet cited.
        </>
      }
    >
      {editor.rows.map((row) => (
        <CatalogRow
          key={row.code}
          dirty={editor.dirtyKeys.has(row.code)}
          saving={editor.savingKey === row.code}
          onSave={() => void editor.save(row.code)}
          onRevert={() => editor.revert(row.code)}
        >
          {/* The label is read-only: update_booking_classification does not
              accept one, and this table has no is_active column at all. */}
          <td className="px-4 py-2">
            <span className="text-sm text-gray-900">{row.label}</span>
          </td>
          <CheckboxCell
            rowKey={row.code}
            field="discount eligible"
            checked={row.isDiscountEligible}
            onChange={(isDiscountEligible) =>
              editor.update(row.code, { isDiscountEligible })
            }
          />
          <SortCell
            rowKey={row.code}
            value={row.sortOrder}
            errors={editor.rowErrors[row.code]}
            onChange={(sortOrder) => editor.update(row.code, { sortOrder })}
          />
        </CatalogRow>
      ))}
    </CatalogCard>
  );
}
